import { useEffect, useMemo, useRef } from 'react'
import L from 'leaflet'
import { ImageIcon, Maximize2 } from 'lucide-react'
import { LayersControl, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import type { UploadedPhoto } from '../types'

interface BasemapDefinition {
  name: string
  url: string
  attribution: string
  subdomains?: string
  maxNativeZoom?: number
  isDefault: boolean
}

interface PhotoMapProps {
  photos: UploadedPhoto[]
  photoNumbers: Map<string, number>
  selectedPhotoId: string | null
  isAssigningLocation: boolean
  fitRequest: number
  onSelectPhoto: (photo: UploadedPhoto) => void
  onEnlarge: (photo: UploadedPhoto) => void
  onAssignLocation: (latitude: number, longitude: number) => void
}

export function PhotoMap({
  photos,
  photoNumbers,
  selectedPhotoId,
  isAssigningLocation,
  fitRequest,
  onSelectPhoto,
  onEnlarge,
  onAssignLocation,
}: PhotoMapProps) {
  const markerRefs = useRef(new Map<string, L.Marker>())
  const mappedPhotos = useMemo(
    () => photos.filter((photo) => photo.latitude !== null && photo.longitude !== null),
    [photos],
  )

  useEffect(() => {
    if (!selectedPhotoId) {
      return
    }

    markerRefs.current.get(selectedPhotoId)?.openPopup()
  }, [mappedPhotos, selectedPhotoId])

  return (
    <MapContainer
      center={[39.5, -98.35]}
      zoom={4}
      className={`photo-map${isAssigningLocation ? ' photo-map-assigning' : ''}`}
      scrollWheelZoom
    >
      <LayersControl position="topright" collapsed>
        {BASEMAPS.map((basemap) => (
          <LayersControl.BaseLayer key={basemap.name} name={basemap.name} checked={basemap.isDefault}>
            <TileLayer
              attribution={basemap.attribution}
              url={basemap.url}
              {...(basemap.subdomains ? { subdomains: basemap.subdomains } : {})}
              {...(basemap.maxNativeZoom ? { maxNativeZoom: basemap.maxNativeZoom } : {})}
            />
          </LayersControl.BaseLayer>
        ))}
      </LayersControl>
      <MapAssignmentHandler isAssigningLocation={isAssigningLocation} onAssignLocation={onAssignLocation} />
      <MapController mappedPhotos={mappedPhotos} selectedPhotoId={selectedPhotoId} fitRequest={fitRequest} />
      {mappedPhotos.map((photo) => {
        const photoNumber = photoNumbers.get(photo.id) ?? 0

        return (
          <Marker
            key={photo.id}
            ref={(marker) => {
              if (marker) {
                markerRefs.current.set(photo.id, marker)
              } else {
                markerRefs.current.delete(photo.id)
              }
            }}
            position={[photo.latitude!, photo.longitude!]}
            icon={createPhotoIcon(photo, photoNumber)}
            title={`Photo ${photoNumber}: ${photo.fileName} (${formatLocationSource(photo)} location)`}
            eventHandlers={{
              click: (event) => {
                L.DomEvent.stopPropagation(event.originalEvent)
                onSelectPhoto(photo)
              },
            }}
          >
            <Popup minWidth={320} maxWidth={420}>
              <div className="popup-card">
                {photo.previewUrl ? (
                  <button
                    type="button"
                    className="popup-preview-button"
                    aria-label="Enlarge photo"
                    onClick={() => onEnlarge(photo)}
                  >
                    <img src={photo.previewUrl} alt={photo.fileName} />
                  </button>
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
        )
      })}
    </MapContainer>
  )
}

const OPENTOPOMAP_ATTRIBUTION =
  'Map data: &copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> contributors | DEM: <a href="http://viewfinderpanoramas.org">SRTM</a>, <a href="https://sonny.4lima.de/">Sonny</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'

const BASEMAPS: BasemapDefinition[] = [
  {
    name: 'OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    subdomains: 'abc',
    isDefault: true,
  },
  {
    name: 'OpenTopoMap',
    url: 'https://tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: OPENTOPOMAP_ATTRIBUTION,
    maxNativeZoom: 17,
    isDefault: false,
  },
]

interface MapControllerProps {
  mappedPhotos: UploadedPhoto[]
  selectedPhotoId: string | null
  fitRequest: number
}

function MapController({ mappedPhotos, selectedPhotoId, fitRequest }: MapControllerProps) {
  const map = useMap()

  useEffect(() => {
    const container = map.getContainer()

    if (typeof ResizeObserver === 'undefined') {
      map.invalidateSize()
      return
    }

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize()
    })

    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
    }
  }, [map])

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
      const target = L.latLng(photo.latitude!, photo.longitude!)
      const currentZoom = map.getZoom()

      if (map.getBounds().pad(0.4).contains(target)) {
        map.panTo(target, { animate: true, duration: 0.55 })
        return
      }

      map.flyTo(target, currentZoom, { duration: 0.8 })
    }
  }, [map, mappedPhotos, selectedPhotoId])

  return null
}

function MapAssignmentHandler({
  isAssigningLocation,
  onAssignLocation,
}: {
  isAssigningLocation: boolean
  onAssignLocation: (latitude: number, longitude: number) => void
}) {
  const map = useMap()

  useEffect(() => {
    const container = map.getContainer()

    container.classList.toggle('photo-map-assigning', isAssigningLocation)

    return () => {
      container.classList.remove('photo-map-assigning')
    }
  }, [isAssigningLocation, map])

  useMapEvents({
    click(event) {
      if (isAssigningLocation) {
        const wrappedLatLng = map.wrapLatLng(event.latlng)

        onAssignLocation(wrappedLatLng.lat, wrappedLatLng.lng)
      }
    },
  })

  return null
}

function createPhotoIcon(photo: UploadedPhoto, photoNumber: number): L.DivIcon {
  const markerClassName = photo.locationSource === 'manual' ? ' manual-location-marker' : ''

  if (!photo.previewUrl) {
    return L.divIcon({
      className: `generic-photo-marker${markerClassName}`,
      html: `<div aria-hidden="true"><span class="marker-number">${photoNumber}</span>${getManualMarkerBadge(photo)}</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 28],
      popupAnchor: [0, -28],
    })
  }

  return L.divIcon({
    className: `thumbnail-marker${markerClassName}`,
    html: `<div class="marker-thumb-frame" aria-hidden="true"><img src="${photo.previewUrl}" alt="" /><span class="marker-number">${photoNumber}</span>${getManualMarkerBadge(photo)}</div>`,
    iconSize: [38, 38],
    iconAnchor: [19, 38],
    popupAnchor: [0, -38],
  })
}

function getManualMarkerBadge(photo: UploadedPhoto): string {
  return photo.locationSource === 'manual' ? '<span class="manual-marker-badge">M</span>' : ''
}

function formatLocationSource(photo: UploadedPhoto): string {
  if (photo.locationSource === 'manual') {
    return 'user assigned'
  }

  if (photo.locationSource === 'exif') {
    return 'EXIF'
  }

  return 'no'
}

function GenericPreview({ message }: { message: string }) {
  return (
    <div className="generic-preview">
      <ImageIcon size={28} />
      <span>{message}</span>
    </div>
  )
}
