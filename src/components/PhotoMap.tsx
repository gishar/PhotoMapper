import { useEffect, useMemo } from 'react'
import L from 'leaflet'
import { ImageIcon, Maximize2 } from 'lucide-react'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import type { UploadedPhoto } from '../types'

interface PhotoMapProps {
  photos: UploadedPhoto[]
  selectedPhotoId: string | null
  fitRequest: number
  onEnlarge: (photo: UploadedPhoto) => void
}

export function PhotoMap({ photos, selectedPhotoId, fitRequest, onEnlarge }: PhotoMapProps) {
  const mappedPhotos = useMemo(
    () => photos.filter((photo) => photo.latitude !== null && photo.longitude !== null),
    [photos],
  )

  return (
    <MapContainer center={[39.5, -98.35]} zoom={4} className="photo-map" scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapController mappedPhotos={mappedPhotos} selectedPhotoId={selectedPhotoId} fitRequest={fitRequest} />
      {mappedPhotos.map((photo) => (
        <Marker key={photo.id} position={[photo.latitude!, photo.longitude!]} icon={createPhotoIcon(photo)}>
          <Popup minWidth={320} maxWidth={420}>
            <div className="popup-card">
              {photo.previewUrl ? (
                <img src={photo.previewUrl} alt={photo.fileName} />
              ) : (
                <GenericPreview message={photo.previewMessage} />
              )}
              <strong>{photo.fileName}</strong>
              <span className={`preview-status preview-status-${photo.previewStatus}`}>{photo.previewMessage}</span>
              <dl>
                <div>
                  <dt>Latitude</dt>
                  <dd>{photo.latitude!.toFixed(8)}</dd>
                </div>
                <div>
                  <dt>Longitude</dt>
                  <dd>{photo.longitude!.toFixed(8)}</dd>
                </div>
                {photo.dateTaken ? (
                  <div>
                    <dt>Date</dt>
                    <dd>{photo.dateTaken}</dd>
                  </div>
                ) : null}
                <div>
                  <dt>Status</dt>
                  <dd>{photo.gpsStatus === 'mapped' ? 'GPS mapped' : photo.gpsStatus}</dd>
                </div>
              </dl>
              <button
                type="button"
                className="secondary-button"
                onClick={() => onEnlarge(photo)}
              >
                <Maximize2 size={15} />
                Enlarge
              </button>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}

interface MapControllerProps {
  mappedPhotos: UploadedPhoto[]
  selectedPhotoId: string | null
  fitRequest: number
}

function MapController({ mappedPhotos, selectedPhotoId, fitRequest }: MapControllerProps) {
  const map = useMap()

  useEffect(() => {
    if (mappedPhotos.length === 0 || fitRequest === 0) {
      return
    }

    const photoLocations = mappedPhotos.map((photo) => L.latLng(photo.latitude!, photo.longitude!))

    if (photoLocations.length === 1) {
      map.setView(photoLocations[0], 18)
      return
    }

    map.fitBounds(L.latLngBounds(photoLocations), {
      padding: [24, 24],
      maxZoom: 19,
    })
  }, [fitRequest, map, mappedPhotos])

  useEffect(() => {
    const photo = mappedPhotos.find((item) => item.id === selectedPhotoId)

    if (photo) {
      map.flyTo([photo.latitude!, photo.longitude!], Math.max(map.getZoom(), 17), { duration: 0.8 })
    }
  }, [map, mappedPhotos, selectedPhotoId])

  return null
}

function createPhotoIcon(photo: UploadedPhoto): L.DivIcon {
  if (!photo.previewUrl) {
    return L.divIcon({
      className: 'generic-photo-marker',
      html: '<div aria-hidden="true"></div>',
      iconSize: [28, 28],
      iconAnchor: [14, 28],
      popupAnchor: [0, -28],
    })
  }

  return L.divIcon({
    className: 'thumbnail-marker',
    html: `<img src="${photo.previewUrl}" alt="" />`,
    iconSize: [38, 38],
    iconAnchor: [19, 38],
    popupAnchor: [0, -38],
  })
}

function GenericPreview({ message }: { message: string }) {
  return (
    <div className="generic-preview">
      <ImageIcon size={28} />
      <span>{message}</span>
    </div>
  )
}
