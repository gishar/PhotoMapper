import type { UploadedPhoto } from '../types'

export function buildPhotoCsv(photos: UploadedPhoto[]): string {
  const rows = [
    ['file_name', 'latitude', 'longitude', 'date_taken', 'gps_status', 'notes'],
    ...photos.map((photo) => [
      photo.fileName,
      formatCoordinate(photo.latitude),
      formatCoordinate(photo.longitude),
      photo.dateTaken ?? '',
      photo.gpsStatus,
      '',
    ]),
  ]

  return rows.map((row) => row.map(escapeCsvCell).join(',')).join('\n')
}

export function downloadCsv(csv: string, fileName: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = fileName
  link.click()

  URL.revokeObjectURL(url)
}

function formatCoordinate(value: number | null): string {
  return typeof value === 'number' ? value.toFixed(8) : ''
}

function escapeCsvCell(value: string): string {
  if (!/[",\n\r]/.test(value)) {
    return value
  }

  return `"${value.replaceAll('"', '""')}"`
}
