import { Download, FolderOpen, ImageIcon, LocateFixed, Trash2, Upload } from 'lucide-react'
import type { PhotoStatusFilter, UploadedPhoto } from '../types'

interface PhotoSidebarProps {
  photos: UploadedPhoto[]
  totalPhotoCount: number
  totalMappedPhotoCount: number
  isProcessing: boolean
  isDragOver: boolean
  dropMessage: string | null
  activeFilter: PhotoStatusFilter
  onFilesSelected: (files: FileList | null) => void
  onFolderSelected: (files: FileList | null) => void
  onFilterChange: (filter: PhotoStatusFilter) => void
  onFitToPhotos: () => void
  onClearAll: () => void
  onExportCsv: () => void
  onSelectPhoto: (photo: UploadedPhoto) => void
}

export function PhotoSidebar({
  photos,
  totalPhotoCount,
  totalMappedPhotoCount,
  isProcessing,
  isDragOver,
  dropMessage,
  activeFilter,
  onFilesSelected,
  onFolderSelected,
  onFilterChange,
  onFitToPhotos,
  onClearAll,
  onExportCsv,
  onSelectPhoto,
}: PhotoSidebarProps) {
  const mappedPhotos = photos.filter(hasUsableCoordinates)
  const withoutGps = photos.filter((photo) => !hasUsableCoordinates(photo))
  const visiblePhotoCount = photos.length

  return (
    <aside className="sidebar">
      <header>
        <div className="app-title">
          <img src="/app-icon.png" alt="Photo Mapper icon" />
          <div>
            <h1>Photo Mapper</h1>
            <p>Local EXIF GPS mapping for field visit photos.</p>
          </div>
        </div>
        <div className={`drop-upload-panel${isDragOver ? ' drop-upload-panel-active' : ''}`}>
          <p>Drag photos here or upload photos.</p>
          <div className="upload-options">
            <label className="upload-button">
              <Upload size={16} />
              Upload Photos
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/heic,image/heif,.jpg,.jpeg,.png,.heic,.heif"
                multiple
                disabled={isProcessing}
                onChange={(event) => {
                  onFilesSelected(event.target.files)
                  event.currentTarget.value = ''
                }}
              />
            </label>
            <label className="secondary-button folder-upload-button">
              <FolderOpen size={16} />
              Select Folder
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/heic,image/heif,.jpg,.jpeg,.png,.heic,.heif"
                multiple
                disabled={isProcessing}
                ref={(input) => input?.setAttribute('webkitdirectory', '')}
                onChange={(event) => {
                  onFolderSelected(event.target.files)
                  event.currentTarget.value = ''
                }}
              />
            </label>
          </div>
        </div>
      </header>

      <div className="toolbar" aria-label="Photo actions">
        <button type="button" onClick={onFitToPhotos} disabled={totalMappedPhotoCount === 0}>
          <LocateFixed size={16} />
          Fit to Photos
        </button>
        <button type="button" onClick={onExportCsv} disabled={totalPhotoCount === 0}>
          <Download size={16} />
          Export CSV
        </button>
        <button type="button" onClick={onClearAll} disabled={totalPhotoCount === 0}>
          <Trash2 size={16} />
          Clear All
        </button>
      </div>

      {isProcessing ? <div className="status-message">Reading photo metadata...</div> : null}
      {dropMessage ? (
        <div className="status-message" role="status">
          {dropMessage}
        </div>
      ) : null}

      <section className="photo-filter-section" aria-label="Photo status filters">
        <div className="photo-filter-summary">
          {visiblePhotoCount === totalPhotoCount
            ? `${totalPhotoCount} photos imported`
            : `${visiblePhotoCount} of ${totalPhotoCount} photos shown`}
        </div>
        <div className="photo-filters">
          {PHOTO_FILTER_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={option.value === activeFilter ? 'photo-filter-active' : undefined}
              aria-pressed={option.value === activeFilter}
              onClick={() => onFilterChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      {visiblePhotoCount === 0 ? (
        <p className="empty-state">{getFilterEmptyMessage(activeFilter, totalPhotoCount)}</p>
      ) : (
        <>
          <section className="photo-section">
            <h2>Mapped Photos ({mappedPhotos.length})</h2>
            <div className="photo-list">
              {mappedPhotos.length === 0 ? <p className="empty-state">No mapped photos match this filter.</p> : null}
              {mappedPhotos.map((photo) => (
                <PhotoListItem key={photo.id} photo={photo} onSelectPhoto={onSelectPhoto} />
              ))}
            </div>
          </section>

          <section className="photo-section">
            <h2>Photos without GPS ({withoutGps.length})</h2>
            <div className="photo-list">
              {withoutGps.length === 0 ? (
                <p className="empty-state">No photos without GPS match this filter.</p>
              ) : null}
              {withoutGps.map((photo) => (
                <PhotoListItem key={photo.id} photo={photo} onSelectPhoto={onSelectPhoto} />
              ))}
            </div>
          </section>
        </>
      )}
    </aside>
  )
}

const PHOTO_FILTER_OPTIONS: Array<{ value: PhotoStatusFilter; label: string }> = [
  { value: 'all', label: 'All photos' },
  { value: 'mapped', label: 'Mapped only' },
  { value: 'missing-gps', label: 'Missing GPS' },
  { value: 'metadata-errors', label: 'Metadata errors' },
  { value: 'selected', label: 'Selected photo' },
]

function hasUsableCoordinates(photo: UploadedPhoto): boolean {
  return photo.latitude !== null && photo.longitude !== null
}

function getFilterEmptyMessage(filter: PhotoStatusFilter, totalPhotoCount: number): string {
  if (totalPhotoCount === 0) {
    return 'Upload photos to start mapping.'
  }

  if (filter === 'selected') {
    return 'No photo is selected.'
  }

  return 'No photos match this filter.'
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
