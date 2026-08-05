export type GpsStatus = 'mapped' | 'missing_gps' | 'metadata_error'
export type LocationSource = 'exif' | 'manual' | 'none'
export type PreviewStatus = 'native' | 'converted' | 'failed'
export type PhotoStatusFilter = 'all' | 'mapped' | 'missing-gps' | 'metadata-errors' | 'selected'

export interface UploadedPhoto {
  id: string
  fileName: string
  isHeic: boolean
  latitude: number | null
  longitude: number | null
  locationSource: LocationSource
  dateTaken: string | null
  gpsStatus: GpsStatus
  previewUrl: string | null
  previewStatus: PreviewStatus
  previewMessage: string
  previewUnavailableReason: string | null
  objectUrlsToRevoke: string[]
  error?: string
}
