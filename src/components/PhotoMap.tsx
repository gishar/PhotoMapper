import { useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import L from 'leaflet'
import 'leaflet.markercluster'
import { LayersControl, MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet'
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
  fitPhotos: UploadedPhoto[]
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
  fitPhotos,
  photoNumbers,
  selectedPhotoId,
  isAssigningLocation,
  fitRequest,
  onSelectPhoto,
  onEnlarge,
  onAssignLocation,
}: PhotoMapProps) {
  const markerRefs = useRef(new Map<string, L.Marker>())
  const markerClusterGroupRef = useRef<L.MarkerClusterGroup | null>(null)
  const mappedPhotos = useMemo(
    () => photos.filter((photo) => photo.latitude !== null && photo.longitude !== null),
    [photos],
  )
  const fitMappedPhotos = useMemo(
    () => fitPhotos.filter((photo) => photo.latitude !== null && photo.longitude !== null),
    [fitPhotos],
  )

  useEffect(() => {
    if (!selectedPhotoId) {
      return
    }

    const marker = markerRefs.current.get(selectedPhotoId)

    if (!marker) {
      return
    }

    const clusterGroup = markerClusterGroupRef.current

    if (clusterGroup) {
      clusterGroup.zoomToShowLayer(marker, () => marker.openPopup())
      return
    }

    marker.openPopup()
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
      <MapController
        mappedPhotos={mappedPhotos}
        fitMappedPhotos={fitMappedPhotos}
        selectedPhotoId={selectedPhotoId}
        fitRequest={fitRequest}
      />
      <ClusteredPhotoMarkers
        mappedPhotos={mappedPhotos}
        markerRefs={markerRefs}
        markerClusterGroupRef={markerClusterGroupRef}
        photoNumbers={photoNumbers}
        onSelectPhoto={onSelectPhoto}
        onEnlarge={onEnlarge}
      />
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

interface ClusteredPhotoMarkersProps {
  mappedPhotos: UploadedPhoto[]
  markerRefs: MutableRefObject<Map<string, L.Marker>>
  markerClusterGroupRef: MutableRefObject<L.MarkerClusterGroup | null>
  photoNumbers: Map<string, number>
  onSelectPhoto: (photo: UploadedPhoto) => void
  onEnlarge: (photo: UploadedPhoto) => void
}

function ClusteredPhotoMarkers({
  mappedPhotos,
  markerRefs,
  markerClusterGroupRef,
  photoNumbers,
  onSelectPhoto,
  onEnlarge,
}: ClusteredPhotoMarkersProps) {
  const map = useMap()

  useEffect(() => {
    const markerRefMap = markerRefs.current

    markerRefMap.clear()

    const clusterGroup = L.markerClusterGroup({
      chunkedLoading: true,
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      zoomToBoundsOnClick: true,
      spiderfyDistanceMultiplier: 1.35,
      maxClusterRadius: 54,
      iconCreateFunction: createClusterIcon,
    })

    mappedPhotos.forEach((photo) => {
      const photoNumber = photoNumbers.get(photo.id) ?? 0
      const marker = L.marker([photo.latitude!, photo.longitude!], {
        icon: createPhotoIcon(photo, photoNumber),
        keyboard: true,
        title: `Photo ${photoNumber}: ${photo.fileName} (${formatLocationSource(photo)} location)`,
      })

      marker.on('click', () => onSelectPhoto(photo))
      marker.bindPopup(createPopupContent(photo, onEnlarge), { minWidth: 320, maxWidth: 420 })
      markerRefMap.set(photo.id, marker)
      clusterGroup.addLayer(marker)
    })

    markerClusterGroupRef.current = clusterGroup
    map.addLayer(clusterGroup)

    return () => {
      map.removeLayer(clusterGroup)
      markerRefMap.clear()

      if (markerClusterGroupRef.current === clusterGroup) {
        markerClusterGroupRef.current = null
      }
    }
  }, [map, mappedPhotos, markerClusterGroupRef, markerRefs, onEnlarge, onSelectPhoto, photoNumbers])

  return null
}

interface MapControllerProps {
  mappedPhotos: UploadedPhoto[]
  fitMappedPhotos: UploadedPhoto[]
  selectedPhotoId: string | null
  fitRequest: number
}

function MapController({ mappedPhotos, fitMappedPhotos, selectedPhotoId, fitRequest }: MapControllerProps) {
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
    if (fitMappedPhotos.length === 0 || fitRequest === 0) {
      return
    }

    const photoLocations = fitMappedPhotos.map((photo) => L.latLng(photo.latitude!, photo.longitude!))

    if (photoLocations.length === 1) {
      map.setView(photoLocations[0], 18)
      return
    }

    map.fitBounds(L.latLngBounds(photoLocations), {
      padding: [24, 24],
      maxZoom: 19,
    })
  }, [fitMappedPhotos, fitRequest, map])

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

function createClusterIcon(cluster: L.MarkerCluster): L.DivIcon {
  return L.divIcon({
    className: 'photo-marker-cluster',
    html: `<span>${cluster.getChildCount()}</span>`,
    iconSize: [42, 42],
    iconAnchor: [21, 21],
  })
}

function createPopupContent(photo: UploadedPhoto, onEnlarge: (photo: UploadedPhoto) => void): HTMLElement {
  const card = document.createElement('div')
  card.className = 'popup-card'

  if (photo.previewUrl) {
    const previewButton = document.createElement('button')
    previewButton.type = 'button'
    previewButton.className = 'popup-preview-button'
    previewButton.setAttribute('aria-label', 'Enlarge photo')
    previewButton.addEventListener('click', () => onEnlarge(photo))

    const image = document.createElement('img')
    image.src = photo.previewUrl
    image.alt = photo.fileName
    previewButton.append(image)
    card.append(previewButton)
  } else {
    const placeholder = document.createElement('div')
    placeholder.className = 'generic-preview'
    const placeholderMessage = document.createElement('span')
    placeholderMessage.textContent = photo.previewMessage
    placeholder.append(placeholderMessage)
    card.append(placeholder)
  }

  const fileName = document.createElement('strong')
  fileName.textContent = photo.fileName
  card.append(fileName)

  const previewStatus = document.createElement('span')
  previewStatus.className = `preview-status preview-status-${photo.previewStatus}`
  previewStatus.textContent = photo.previewMessage
  card.append(previewStatus)

  card.append(createPopupDetails(photo))

  const enlargeButton = document.createElement('button')
  enlargeButton.type = 'button'
  enlargeButton.className = 'secondary-button'
  enlargeButton.textContent = 'Enlarge'
  enlargeButton.addEventListener('click', () => onEnlarge(photo))
  card.append(enlargeButton)

  return card
}

function createPopupDetails(photo: UploadedPhoto): HTMLDListElement {
  const details = document.createElement('dl')

  details.append(
    createDescriptionRow('Latitude', photo.latitude!.toFixed(8)),
    createDescriptionRow('Longitude', photo.longitude!.toFixed(8)),
  )

  if (photo.dateTaken) {
    details.append(createDescriptionRow('Date', photo.dateTaken))
  }

  details.append(createDescriptionRow('Status', photo.gpsStatus === 'mapped' ? 'GPS mapped' : photo.gpsStatus))

  return details
}

function createDescriptionRow(label: string, value: string): HTMLDivElement {
  const row = document.createElement('div')
  const term = document.createElement('dt')
  const description = document.createElement('dd')

  term.textContent = label
  description.textContent = value
  row.append(term, description)

  return row
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
