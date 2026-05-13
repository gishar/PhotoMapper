import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ImageModal } from './components/ImageModal'
import { PhotoMap } from './components/PhotoMap'
import { PhotoSidebar } from './components/PhotoSidebar'
import type { UploadedPhoto } from './types'
import { buildPhotoCsv, downloadCsv } from './utils/csv'
import { readExifMetadata } from './utils/exif'
import { isHeicFile } from './utils/fileTypes'
import { createPreviewImage, revokeObjectUrls } from './utils/preview'
import './App.css'

function App() {
  const [photos, setPhotos] = useState<UploadedPhoto[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null)
  const [fitRequest, setFitRequest] = useState(0)
  const [enlargedPhoto, setEnlargedPhoto] = useState<UploadedPhoto | null>(null)
  const photosRef = useRef<UploadedPhoto[]>([])

  const mappedPhotos = useMemo(
    () => photos.filter((photo) => photo.latitude !== null && photo.longitude !== null),
    [photos],
  )

  const handleFilesSelected = useCallback(async (fileList: FileList | null) => {
    const files = Array.from(fileList ?? [])

    if (files.length === 0) {
      return
    }

    setIsProcessing(true)

    try {
      const uploadedPhotos = await Promise.all(files.map(processFile))
      setPhotos((currentPhotos) => [...currentPhotos, ...uploadedPhotos])

      if (uploadedPhotos.some((photo) => photo.gpsStatus === 'mapped')) {
        setFitRequest((request) => request + 1)
      }
    } finally {
      setIsProcessing(false)
    }
  }, [])

  const handleClearAll = useCallback(() => {
    photos.forEach((photo) => revokeObjectUrls(photo.objectUrlsToRevoke))
    setPhotos([])
    setSelectedPhotoId(null)
    setEnlargedPhoto(null)
  }, [photos])

  const handleExportCsv = useCallback(() => {
    downloadCsv(buildPhotoCsv(photos), 'field-photo-mapper-export.csv')
  }, [photos])

  useEffect(() => {
    photosRef.current = photos
  }, [photos])

  useEffect(() => {
    return () => {
      photosRef.current.forEach((photo) => revokeObjectUrls(photo.objectUrlsToRevoke))
    }
  }, [])

  return (
    <main className="app-shell">
      <PhotoSidebar
        photos={photos}
        isProcessing={isProcessing}
        onFilesSelected={handleFilesSelected}
        onFitToPhotos={() => setFitRequest((request) => request + 1)}
        onClearAll={handleClearAll}
        onExportCsv={handleExportCsv}
        onSelectPhoto={(photo) => setSelectedPhotoId(photo.id)}
      />
      <section className="map-panel" aria-label="Mapped field photos">
        <PhotoMap
          photos={photos}
          selectedPhotoId={selectedPhotoId}
          fitRequest={fitRequest}
          onEnlarge={setEnlargedPhoto}
        />
        {mappedPhotos.length === 0 ? (
          <div className="map-empty-note">Upload geotagged field photos to place exact EXIF points on the map.</div>
        ) : null}
      </section>
      <ImageModal photo={enlargedPhoto} onClose={() => setEnlargedPhoto(null)} />
    </main>
  )
}

async function processFile(file: File): Promise<UploadedPhoto> {
  const id = `${file.name}-${file.lastModified}-${crypto.randomUUID()}`
  const isHeic = isHeicFile(file)
  const [metadataResult, previewResult] = await Promise.allSettled([
    readExifMetadata(file),
    createPreviewImage(file),
  ])

  const metadata =
    metadataResult.status === 'fulfilled'
      ? metadataResult.value
      : { latitude: null, longitude: null, dateTaken: null }
  const preview =
    previewResult.status === 'fulfilled'
      ? previewResult.value
      : {
          previewUrl: null,
          previewStatus: 'failed' as const,
          previewMessage: 'Preview unavailable',
          objectUrlsToRevoke: [],
        }
  const hasGps = metadata.latitude !== null && metadata.longitude !== null

  return {
    id,
    fileName: file.name,
    isHeic,
    latitude: metadata.latitude,
    longitude: metadata.longitude,
    dateTaken: metadata.dateTaken,
    gpsStatus: hasGps ? 'mapped' : metadataResult.status === 'rejected' ? 'metadata_error' : 'missing_gps',
    previewUrl: preview.previewUrl,
    previewStatus: preview.previewStatus,
    previewMessage: preview.previewMessage,
    previewUnavailableReason: preview.previewStatus === 'failed' ? preview.previewMessage : null,
    objectUrlsToRevoke: preview.objectUrlsToRevoke,
    error: metadataResult.status === 'rejected' ? metadataResult.reason.message : undefined,
  }
}

export default App
