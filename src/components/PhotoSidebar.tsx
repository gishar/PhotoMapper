import { Cloud, Download, ImageIcon, LocateFixed, Trash2, Upload } from 'lucide-react'
import type { UploadedPhoto } from '../types'

interface PhotoSidebarProps {
  photos: UploadedPhoto[]
  isProcessing: boolean
  isCloudImporting: boolean
  importError: string | null
  onFilesSelected: (files: FileList | null) => void
  onImportGoogleDrive: () => void
  onFitToPhotos: () => void
  onClearAll: () => void
  onExportCsv: () => void
  onSelectPhoto: (photo: UploadedPhoto) => void
}

export function PhotoSidebar({
  photos,
  isProcessing,
  isCloudImporting,
  importError,
  onFilesSelected,
  onImportGoogleDrive,
  onFitToPhotos,
  onClearAll,
  onExportCsv,
  onSelectPhoto,
}: PhotoSidebarProps) {
  const mappedPhotos = photos.filter((photo) => photo.gpsStatus === 'mapped')
  const withoutGps = photos.filter((photo) => photo.gpsStatus !== 'mapped')
  const isImportDisabled = isProcessing || isCloudImporting

  return (
    <aside className="sidebar">
      <header>
        <div className="app-title">
          <img src="/app-icon.png" alt="Field Photo Mapper icon" />
          <div>
            <h1>Field Photo Mapper</h1>
            <p>Local EXIF GPS mapping for field visit photos.</p>
          </div>
        </div>
        <div className="import-actions" aria-label="Photo import sources">
          <label className="upload-button">
            <Upload size={16} />
            From Computer
            <input
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/heic,image/heif,.jpg,.jpeg,.png,.heic,.heif"
              multiple
              disabled={isImportDisabled}
              onChange={(event) => {
                onFilesSelected(event.target.files)
                event.currentTarget.value = ''
              }}
            />
          </label>
          <button type="button" className="secondary-button" onClick={onImportGoogleDrive} disabled={isImportDisabled}>
            <Cloud size={16} />
            From Google Drive
          </button>
          <button type="button" className="secondary-button" disabled>
            From OneDrive (Coming soon)
          </button>
          <button type="button" className="secondary-button" disabled>
            From Dropbox (Coming soon)
          </button>
          <button type="button" className="secondary-button" disabled>
            From Box (Coming soon)
          </button>
        </div>
      </header>

      <div className="toolbar" aria-label="Photo actions">
        <button type="button" onClick={onFitToPhotos} disabled={mappedPhotos.length === 0}>
          <LocateFixed size={16} />
          Fit to Photos
        </button>
        <button type="button" onClick={onExportCsv} disabled={photos.length === 0}>
          <Download size={16} />
          Export CSV
        </button>
        <button type="button" onClick={onClearAll} disabled={photos.length === 0}>
          <Trash2 size={16} />
          Clear All
        </button>
      </div>

      {isProcessing ? <div className="status-message">Reading photo metadata...</div> : null}
      {isCloudImporting ? <div className="status-message">Opening Google Drive...</div> : null}
      {importError ? (
        <div className="status-message status-message-error" role="alert">
          {importError}
        </div>
      ) : null}

      <section className="photo-section">
        <h2>Mapped Photos ({mappedPhotos.length})</h2>
        <div className="photo-list">
          {mappedPhotos.length === 0 ? <p className="empty-state">Upload photos with GPS metadata to map them.</p> : null}
          {mappedPhotos.map((photo) => (
            <PhotoListItem key={photo.id} photo={photo} onSelectPhoto={onSelectPhoto} />
          ))}
        </div>
      </section>

      <section className="photo-section">
        <h2>Photos without GPS ({withoutGps.length})</h2>
        <div className="photo-list">
          {withoutGps.length === 0 ? <p className="empty-state">No unmapped photos yet.</p> : null}
          {withoutGps.map((photo) => (
            <PhotoListItem key={photo.id} photo={photo} onSelectPhoto={onSelectPhoto} />
          ))}
        </div>
      </section>
    </aside>
  )
}

interface PhotoListItemProps {
  photo: UploadedPhoto
  onSelectPhoto: (photo: UploadedPhoto) => void
}

function PhotoListItem({ photo, onSelectPhoto }: PhotoListItemProps) {
  const hasGps = photo.latitude !== null && photo.longitude !== null

  return (
    <button type="button" className="photo-list-item" onClick={() => onSelectPhoto(photo)} disabled={!hasGps}>
      {photo.previewUrl ? (
        <img src={photo.previewUrl} alt="" />
      ) : (
        <div className="list-thumb-placeholder" title={photo.previewUnavailableReason ?? undefined}>
          {photo.isHeic ? 'HEIC' : <ImageIcon size={18} />}
        </div>
      )}
      <span>
        <strong>{photo.fileName}</strong>
        <small className={`preview-status preview-status-${photo.previewStatus}`}>{photo.previewMessage}</small>
        <small>
          {hasGps
            ? `${photo.latitude!.toFixed(6)}, ${photo.longitude!.toFixed(6)}`
            : photo.error ?? 'GPS metadata not found'}
        </small>
      </span>
    </button>
  )
}
