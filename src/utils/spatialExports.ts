import type { UploadedPhoto } from '../types'

interface ExportablePhoto {
  photo: UploadedPhoto
  photoNumber: number
  latitude: number
  longitude: number
}

interface GeoJsonPointFeature {
  type: 'Feature'
  geometry: {
    type: 'Point'
    coordinates: [number, number]
  }
  properties: Record<string, string | number | boolean | null>
}

interface GeoJsonFeatureCollection {
  type: 'FeatureCollection'
  features: GeoJsonPointFeature[]
}

export function getExportablePhotos(photos: UploadedPhoto[]): ExportablePhoto[] {
  return photos.flatMap((photo, index) => {
    if (!hasValidCoordinates(photo)) {
      return []
    }

    return [
      {
        photo,
        photoNumber: index + 1,
        latitude: photo.latitude,
        longitude: photo.longitude,
      },
    ]
  })
}

export function getSkippedPhotoCount(photos: UploadedPhoto[]): number {
  return photos.length - getExportablePhotos(photos).length
}

export function buildPhotoGeoJson(photos: UploadedPhoto[]): string {
  const collection: GeoJsonFeatureCollection = {
    type: 'FeatureCollection',
    features: getExportablePhotos(photos).map(({ photo, photoNumber, latitude, longitude }) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [longitude, latitude],
      },
      properties: getPhotoProperties(photo, photoNumber),
    })),
  }

  return `${JSON.stringify(collection, null, 2)}\n`
}

export function buildPhotoKml(photos: UploadedPhoto[]): string {
  const placemarks = getExportablePhotos(photos)
    .map(({ photo, photoNumber, latitude, longitude }) => {
      const properties = getPhotoProperties(photo, photoNumber)
      const extendedData = Object.entries(properties)
        .map(
          ([key, value]) =>
            `        <Data name="${escapeXml(key)}"><value>${escapeXml(formatKmlValue(value))}</value></Data>`,
        )
        .join('\n')

      return `    <Placemark>
      <name>${escapeXml(photo.fileName)}</name>
      <description>${escapeXml(getPhotoDescription(photo))}</description>
      <ExtendedData>
${extendedData}
      </ExtendedData>
      <Point>
        <coordinates>${longitude.toFixed(8)},${latitude.toFixed(8)}</coordinates>
      </Point>
    </Placemark>`
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Photo Mapper Export</name>
${placemarks}
  </Document>
</kml>
`
}

export function downloadTextFile(content: string, fileName: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = fileName
  link.click()

  URL.revokeObjectURL(url)
}

function hasValidCoordinates(photo: UploadedPhoto): photo is UploadedPhoto & { latitude: number; longitude: number } {
  return (
    typeof photo.latitude === 'number' &&
    Number.isFinite(photo.latitude) &&
    typeof photo.longitude === 'number' &&
    Number.isFinite(photo.longitude)
  )
}

function getPhotoProperties(photo: UploadedPhoto, photoNumber: number): Record<string, string | number | boolean | null> {
  const properties: Record<string, string | number | boolean | null> = {
    photo_number: photoNumber,
    file_name: photo.fileName,
    date_taken: photo.dateTaken,
    gps_status: photo.gpsStatus,
    location_source: photo.locationSource,
    manually_located: photo.locationSource === 'manual',
    preview_status: photo.previewStatus,
    preview_message: photo.previewMessage,
  }

  if (photo.error) {
    properties.error = photo.error
  }

  return properties
}

function getPhotoDescription(photo: UploadedPhoto): string {
  const status = photo.locationSource === 'manual' ? 'User assigned location' : 'GPS mapped from EXIF'
  const details = [
    status,
    photo.dateTaken ? `Date taken: ${photo.dateTaken}` : null,
    photo.error ? `Error: ${photo.error}` : null,
  ]

  return details.filter(Boolean).join('\n')
}

function formatKmlValue(value: string | number | boolean | null): string {
  return value === null ? '' : String(value)
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}
