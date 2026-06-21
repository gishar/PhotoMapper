export type GpsStatus = 'mapped' | 'missing_gps' | 'metadata_error'
export type PreviewStatus = 'native' | 'converted' | 'failed'
export type PhotoImportSource = 'computer' | 'google-drive' | 'onedrive' | 'dropbox' | 'box'

export interface UploadedPhoto {
  id: string
  fileName: string
  isHeic: boolean
  latitude: number | null
  longitude: number | null
  dateTaken: string | null
  gpsStatus: GpsStatus
  previewUrl: string | null
  previewStatus: PreviewStatus
  previewMessage: string
  previewUnavailableReason: string | null
  objectUrlsToRevoke: string[]
  error?: string
}
