import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { ImageModal } from './components/ImageModal'
import { PhotoMap } from './components/PhotoMap'
import { PhotoSidebar } from './components/PhotoSidebar'
import type { PhotoStatusFilter, UploadedPhoto } from './types'
import { buildPhotoCsv, downloadCsv } from './utils/csv'
import { readExifMetadata } from './utils/exif'
import { isHeicFile, isSupportedUploadFile } from './utils/fileTypes'
import { createPreviewImage, revokeObjectUrls } from './utils/preview'
import {
  buildPhotoGeoJson,
  buildPhotoKml,
  downloadTextFile,
  getExportablePhotos,
  getSkippedPhotoCount,
} from './utils/spatialExports'
import './App.css'

function App() {
  const [photos, setPhotos] = useState<UploadedPhoto[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null)
  const [fitRequest, setFitRequest] = useState(0)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [dropMessage, setDropMessage] = useState<string | null>(null)
  const [exportMessage, setExportMessage] = useState<string | null>(null)
  const [photoStatusFilter, setPhotoStatusFilter] = useState<PhotoStatusFilter>('all')
  const [assignmentPhotoId, setAssignmentPhotoId] = useState<string | null>(null)
  const photosRef = useRef<UploadedPhoto[]>([])
  const dragDepthRef = useRef(0)

  const mappedPhotos = useMemo(
    () => photos.filter((photo) => photo.latitude !== null && photo.longitude !== null),
    [photos],
  )
  const filteredPhotos = useMemo(
    () => photos.filter((photo) => matchesPhotoStatusFilter(photo, photoStatusFilter, selectedPhotoId)),
    [photoStatusFilter, photos, selectedPhotoId],
  )
  const photoNumbers = useMemo(
    () => new Map(photos.map((photo, index) => [photo.id, index + 1])),
    [photos],
  )
  const assignmentPhotoNumber = assignmentPhotoId ? photoNumbers.get(assignmentPhotoId) ?? null : null
  const selectedPhotoIndex = selectedPhotoId ? mappedPhotos.findIndex((photo) => photo.id === selectedPhotoId) : -1
  const previewPhoto = isPreviewOpen && selectedPhotoIndex >= 0 ? mappedPhotos[selectedPhotoIndex] : null

  const selectPhoto = useCallback((photo: UploadedPhoto) => {
    setSelectedPhotoId(photo.id)
  }, [])

  const enlargePhoto = useCallback((photo: UploadedPhoto) => {
    selectPhoto(photo)
    setIsPreviewOpen(true)
  }, [selectPhoto])

  const selectMappedPhotoAtIndex = useCallback(
    (index: number) => {
      const photo = mappedPhotos[index]

      if (!photo) {
        return
      }

      selectPhoto(photo)
    },
    [mappedPhotos, selectPhoto],
  )

  const importFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) {
      return
    }

    setIsProcessing(true)
    setDropMessage(null)
    setExportMessage(null)

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

  const handleFilesSelected = useCallback(
    async (fileList: FileList | null) => {
      if (isProcessing) {
        return
      }

      await importFiles(Array.from(fileList ?? []))
    },
    [importFiles, isProcessing],
  )

  const handleFolderSelected = useCallback(
    async (fileList: FileList | null) => {
      if (isProcessing) {
        return
      }

      const files = Array.from(fileList ?? []).filter(isSupportedUploadFile)

      if (files.length === 0) {
        setDropMessage('Selected folder did not contain JPG, PNG, HEIC, or HEIF photos.')
        return
      }

      await importFiles(files)
    },
    [importFiles, isProcessing],
  )

  const handleDragEnter = useCallback((event: DragEvent<HTMLElement>) => {
    event.preventDefault()

    if (!event.dataTransfer.types.includes('Files')) {
      return
    }

    dragDepthRef.current += 1
    setIsDragOver(true)
  }, [])

  const handleDragOver = useCallback((event: DragEvent<HTMLElement>) => {
    event.preventDefault()

    if (event.dataTransfer.types.includes('Files')) {
      event.dataTransfer.dropEffect = 'copy'
      setIsDragOver(true)
    }
  }, [])

  const handleDragLeave = useCallback((event: DragEvent<HTMLElement>) => {
    event.preventDefault()
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)

    if (dragDepthRef.current === 0) {
      setIsDragOver(false)
    }
  }, [])

  const handleDrop = useCallback(
    async (event: DragEvent<HTMLElement>) => {
      event.preventDefault()
      dragDepthRef.current = 0
      setIsDragOver(false)

      if (isProcessing) {
        setDropMessage('Photo import is already in progress.')
        return
      }

      const files = Array.from(event.dataTransfer.files).filter(isSupportedUploadFile)

      if (files.length === 0) {
        setDropMessage('Drop JPG, PNG, HEIC, or HEIF photos to import.')
        return
      }

      await importFiles(files)
    },
    [importFiles, isProcessing],
  )

  const handleClearAll = useCallback(() => {
    photos.forEach((photo) => revokeObjectUrls(photo.objectUrlsToRevoke))
    setPhotos([])
    setSelectedPhotoId(null)
    setIsPreviewOpen(false)
    setAssignmentPhotoId(null)
    setExportMessage(null)
  }, [photos])

  const handleExportCsv = useCallback(() => {
    downloadCsv(buildPhotoCsv(photos), 'field-photo-mapper-export.csv')
  }, [photos])

  const handleExportGeoJson = useCallback(() => {
    const skippedCount = getSkippedPhotoCount(photos)

    if (getExportablePhotos(photos).length === 0) {
      setExportMessage(
        `No mapped photos to export. ${skippedCount} photos skipped because they have no mapped location.`,
      )
      return
    }

    downloadTextFile(
      buildPhotoGeoJson(photos),
      'photo-mapper-export.geojson',
      'application/geo+json;charset=utf-8',
    )
    setExportMessage(getExportMessage('GeoJSON', skippedCount))
  }, [photos])

  const handleExportKml = useCallback(() => {
    const skippedCount = getSkippedPhotoCount(photos)

    if (getExportablePhotos(photos).length === 0) {
      setExportMessage(
        `No mapped photos to export. ${skippedCount} photos skipped because they have no mapped location.`,
      )
      return
    }

    downloadTextFile(
      buildPhotoKml(photos),
      'photo-mapper-export.kml',
      'application/vnd.google-earth.kml+xml;charset=utf-8',
    )
    setExportMessage(getExportMessage('KML', skippedCount))
  }, [photos])

  const handleStartLocationAssignment = useCallback((photo: UploadedPhoto) => {
    if (isProcessing || photo.locationSource === 'exif') {
      return
    }

    setSelectedPhotoId(photo.id)
    setAssignmentPhotoId(photo.id)
  }, [isProcessing])

  const handleCancelLocationAssignment = useCallback(() => {
    setAssignmentPhotoId(null)
  }, [])

  const handleAssignLocation = useCallback((latitude: number, longitude: number) => {
    const photoId = assignmentPhotoId

    if (!photoId || isProcessing) {
      return
    }

    setPhotos((currentPhotos) =>
      currentPhotos.map((photo) =>
        photo.id === photoId && photo.locationSource !== 'exif'
          ? { ...photo, latitude, longitude, locationSource: 'manual' }
          : photo,
      ),
    )
    setSelectedPhotoId(photoId)
    setAssignmentPhotoId(null)
  }, [assignmentPhotoId, isProcessing])

  const handleRemoveAssignedLocation = useCallback((photo: UploadedPhoto) => {
    if (photo.locationSource !== 'manual') {
      return
    }

    setPhotos((currentPhotos) =>
      currentPhotos.map((currentPhoto) =>
        currentPhoto.id === photo.id
          ? { ...currentPhoto, latitude: null, longitude: null, locationSource: 'none' }
          : currentPhoto,
      ),
    )
    setAssignmentPhotoId((currentPhotoId) => (currentPhotoId === photo.id ? null : currentPhotoId))
  }, [])

  useEffect(() => {
    photosRef.current = photos
  }, [photos])

  useEffect(() => {
    if (!assignmentPhotoId) {
      return
    }

    const assignmentPhotoExists = photos.some((photo) => photo.id === assignmentPhotoId)
    const selectedDifferentPhoto = Boolean(selectedPhotoId && selectedPhotoId !== assignmentPhotoId)

    if (!assignmentPhotoExists || selectedDifferentPhoto || isProcessing) {
      queueMicrotask(() => setAssignmentPhotoId(null))
    }
  }, [assignmentPhotoId, isProcessing, photos, selectedPhotoId])

  useEffect(() => {
    if (!assignmentPhotoId) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setAssignmentPhotoId(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [assignmentPhotoId])

  useEffect(() => {
    return () => {
      photosRef.current.forEach((photo) => revokeObjectUrls(photo.objectUrlsToRevoke))
    }
  }, [])

  return (
    <main
      className={`app-shell${isDragOver ? ' app-shell-drag-over' : ''}`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <PhotoSidebar
        photos={filteredPhotos}
        photoNumbers={photoNumbers}
        selectedPhotoId={selectedPhotoId}
        totalPhotoCount={photos.length}
        totalMappedPhotoCount={mappedPhotos.length}
        isProcessing={isProcessing}
        isDragOver={isDragOver}
        dropMessage={dropMessage}
        exportMessage={exportMessage}
        activeFilter={photoStatusFilter}
        onFilesSelected={handleFilesSelected}
        onFolderSelected={handleFolderSelected}
        onFilterChange={setPhotoStatusFilter}
        onFitToPhotos={() => setFitRequest((request) => request + 1)}
        onClearAll={handleClearAll}
        onExportCsv={handleExportCsv}
        onExportGeoJson={handleExportGeoJson}
        onExportKml={handleExportKml}
        onSelectPhoto={selectPhoto}
        onStartLocationAssignment={handleStartLocationAssignment}
        onRemoveAssignedLocation={handleRemoveAssignedLocation}
      />
      <section className="map-panel" aria-label="Mapped field photos">
        <PhotoMap
          photos={photos}
          photoNumbers={photoNumbers}
          selectedPhotoId={selectedPhotoId}
          isAssigningLocation={assignmentPhotoId !== null}
          fitRequest={fitRequest}
          onSelectPhoto={selectPhoto}
          onEnlarge={enlargePhoto}
          onAssignLocation={handleAssignLocation}
        />
        {assignmentPhotoId && assignmentPhotoNumber ? (
          <div className="assignment-banner" role="status" aria-live="polite">
            <span>Click the map to assign a location to Photo {assignmentPhotoNumber}.</span>
            <button type="button" className="secondary-button" onClick={handleCancelLocationAssignment}>
              Cancel
            </button>
          </div>
        ) : null}
        {isProcessing ? (
          <div className="map-processing-banner" role="status" aria-live="polite">
            Reading photo details. Please wait. Large files and HEIC/HEIF photos may take longer because the app reads
            GPS metadata and prepares previews locally in your browser.
          </div>
        ) : null}
        {mappedPhotos.length === 0 ? (
          <div className="map-empty-note">Upload geotagged field photos to place exact EXIF points on the map.</div>
        ) : null}
      </section>
      <ImageModal
        photo={previewPhoto}
        hasPrevious={selectedPhotoIndex > 0}
        hasNext={selectedPhotoIndex >= 0 && selectedPhotoIndex < mappedPhotos.length - 1}
        onPrevious={() => selectMappedPhotoAtIndex(selectedPhotoIndex - 1)}
        onNext={() => selectMappedPhotoAtIndex(selectedPhotoIndex + 1)}
        onClose={() => setIsPreviewOpen(false)}
      />
    </main>
  )
}

function matchesPhotoStatusFilter(
  photo: UploadedPhoto,
  filter: PhotoStatusFilter,
  selectedPhotoId: string | null,
): boolean {
  switch (filter) {
    case 'all':
      return true
    case 'mapped':
      return hasUsableCoordinates(photo)
    case 'missing-gps':
      return photo.gpsStatus === 'missing_gps' && !hasUsableCoordinates(photo)
    case 'metadata-errors':
      return photo.gpsStatus === 'metadata_error' || Boolean(photo.error)
    case 'selected':
      return Boolean(selectedPhotoId && photo.id === selectedPhotoId)
  }
}

function hasUsableCoordinates(photo: UploadedPhoto): boolean {
  return photo.latitude !== null && photo.longitude !== null
}

function getExportMessage(format: 'GeoJSON' | 'KML', skippedCount: number): string {
  if (skippedCount === 0) {
    return `${format} export downloaded.`
  }

  return `${format} export downloaded. ${skippedCount} photos skipped because they have no mapped location.`
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
    locationSource: hasGps ? 'exif' : 'none',
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
