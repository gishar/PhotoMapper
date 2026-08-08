import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronDown, ChevronRight, Download, FolderOpen, ImageIcon, LocateFixed, Trash2, Upload } from 'lucide-react'
import type { PhotoStatusFilter, UploadedPhoto } from '../types'

interface PhotoSidebarProps {
  photos: UploadedPhoto[]
  photoNumbers: Map<string, number>
  selectedPhotoId: string | null
  totalPhotoCount: number
  totalMappedPhotoCount: number
  isProcessing: boolean
  isDragOver: boolean
  dropMessage: string | null
  exportMessage: string | null
  activeFilter: PhotoStatusFilter
  onFilesSelected: (files: FileList | null) => void
  onFolderSelected: (files: FileList | null) => void
  onFilterChange: (filter: PhotoStatusFilter) => void
  onFitToPhotos: () => void
  onClearAll: () => void
  onExportCsv: () => void
  onExportGeoJson: () => void
  onExportKml: () => void
  onSelectPhoto: (photo: UploadedPhoto) => void
  onStartLocationAssignment: (photo: UploadedPhoto) => void
  onRemoveAssignedLocation: (photo: UploadedPhoto) => void
}

export function PhotoSidebar({
  photos,
  photoNumbers,
  selectedPhotoId,
  totalPhotoCount,
  totalMappedPhotoCount,
  isProcessing,
  isDragOver,
  dropMessage,
  exportMessage,
  activeFilter,
  onFilesSelected,
  onFolderSelected,
  onFilterChange,
  onFitToPhotos,
  onClearAll,
  onExportCsv,
  onExportGeoJson,
  onExportKml,
  onSelectPhoto,
  onStartLocationAssignment,
  onRemoveAssignedLocation,
}: PhotoSidebarProps) {
  const [expandedGroups, setExpandedGroups] = useState<Record<PhotoGroupKey, boolean>>({
    mapped: true,
    missingGps: true,
    metadataErrors: true,
  })
  const mappedPhotos = photos.filter(hasUsableCoordinates)
  const withoutGps = photos.filter((photo) => photo.gpsStatus === 'missing_gps' && !hasUsableCoordinates(photo))
  const metadataErrors = photos.filter(
    (photo) => (photo.gpsStatus === 'metadata_error' || Boolean(photo.error)) && !hasUsableCoordinates(photo),
  )
  const visiblePhotoCount = photos.length
  const toggleGroup = (group: PhotoGroupKey) => {
    setExpandedGroups((currentGroups) => ({
      ...currentGroups,
      [group]: !currentGroups[group],
    }))
  }

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
        <ExportMenu
          isDisabled={totalPhotoCount === 0}
          onExportCsv={onExportCsv}
          onExportKml={onExportKml}
          onExportGeoJson={onExportGeoJson}
        />
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
      {exportMessage ? (
        <div className="status-message" role="status">
          {exportMessage}
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
          <PhotoGroup
            id="mapped"
            title="Mapped Photos"
            count={mappedPhotos.length}
            isExpanded={expandedGroups.mapped}
            emptyMessage="No mapped photos match this filter."
            onToggle={toggleGroup}
          >
            {mappedPhotos.length > 0 ? (
              <div className="photo-list">
              {mappedPhotos.map((photo) => (
                <PhotoListItem
                  key={photo.id}
                  photo={photo}
                  photoNumber={photoNumbers.get(photo.id) ?? 0}
                  isSelected={photo.id === selectedPhotoId}
                  isProcessing={isProcessing}
                  onSelectPhoto={onSelectPhoto}
                  onStartLocationAssignment={onStartLocationAssignment}
                  onRemoveAssignedLocation={onRemoveAssignedLocation}
                />
              ))}
              </div>
            ) : null}
          </PhotoGroup>

          <PhotoGroup
            id="missingGps"
            title="Photos without GPS"
            count={withoutGps.length}
            isExpanded={expandedGroups.missingGps}
            emptyMessage="No photos without GPS match this filter."
            onToggle={toggleGroup}
          >
            {withoutGps.length > 0 ? (
              <div className="photo-list">
              {withoutGps.map((photo) => (
                <PhotoListItem
                  key={photo.id}
                  photo={photo}
                  photoNumber={photoNumbers.get(photo.id) ?? 0}
                  isSelected={photo.id === selectedPhotoId}
                  isProcessing={isProcessing}
                  onSelectPhoto={onSelectPhoto}
                  onStartLocationAssignment={onStartLocationAssignment}
                  onRemoveAssignedLocation={onRemoveAssignedLocation}
                />
              ))}
              </div>
            ) : null}
          </PhotoGroup>

          <PhotoGroup
            id="metadataErrors"
            title="Metadata Errors"
            count={metadataErrors.length}
            isExpanded={expandedGroups.metadataErrors}
            emptyMessage="No metadata errors match this filter."
            onToggle={toggleGroup}
          >
            {metadataErrors.length > 0 ? (
              <div className="photo-list">
              {metadataErrors.map((photo) => (
                <PhotoListItem
                  key={photo.id}
                  photo={photo}
                  photoNumber={photoNumbers.get(photo.id) ?? 0}
                  isSelected={photo.id === selectedPhotoId}
                  isProcessing={isProcessing}
                  onSelectPhoto={onSelectPhoto}
                  onStartLocationAssignment={onStartLocationAssignment}
                  onRemoveAssignedLocation={onRemoveAssignedLocation}
                />
              ))}
              </div>
            ) : null}
          </PhotoGroup>
        </>
      )}
    </aside>
  )
}

type PhotoGroupKey = 'mapped' | 'missingGps' | 'metadataErrors'

interface ExportMenuProps {
  isDisabled: boolean
  onExportCsv: () => void
  onExportKml: () => void
  onExportGeoJson: () => void
}

function ExportMenu({ isDisabled, onExportCsv, onExportKml, onExportGeoJson }: ExportMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const firstOptionRef = useRef<HTMLButtonElement>(null)

  const runExport = (exportAction: () => void) => {
    exportAction()
    setIsOpen(false)
  }

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen) {
      firstOptionRef.current?.focus()
    }
  }, [isOpen])

  return (
    <div className="export-menu" ref={menuRef}>
      <button
        type="button"
        className="export-menu-trigger"
        disabled={isDisabled}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((currentState) => !currentState)}
      >
        <Download size={16} />
        Export
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {isOpen ? (
        <div className="export-menu-list" role="menu" aria-label="Export photos">
          <button
            type="button"
            role="menuitem"
            ref={firstOptionRef}
            onClick={() => runExport(onExportCsv)}
          >
            <strong>CSV</strong>
            <span>Excel-compatible</span>
          </button>
          <button type="button" role="menuitem" onClick={() => runExport(onExportKml)}>
            <strong>KML</strong>
            <span>Google Earth</span>
          </button>
          <button type="button" role="menuitem" onClick={() => runExport(onExportGeoJson)}>
            <strong>GeoJSON</strong>
            <span>GIS/web maps</span>
          </button>
        </div>
      ) : null}
    </div>
  )
}

interface PhotoGroupProps {
  id: PhotoGroupKey
  title: string
  count: number
  isExpanded: boolean
  emptyMessage: string
  onToggle: (group: PhotoGroupKey) => void
  children: ReactNode
}

function PhotoGroup({ id, title, count, isExpanded, emptyMessage, onToggle, children }: PhotoGroupProps) {
  const listId = `photo-group-${id}`

  return (
    <section className="photo-section">
      <h2>
        <button
          type="button"
          className="photo-section-toggle"
          aria-expanded={isExpanded}
          aria-controls={listId}
          onClick={() => onToggle(id)}
        >
          {isExpanded ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
          <span>{title}</span>
          <span className="photo-section-count">{count}</span>
        </button>
      </h2>
      <div id={listId} className="photo-section-content" hidden={!isExpanded}>
        {isExpanded ? (count === 0 ? <p className="empty-state">{emptyMessage}</p> : children) : null}
      </div>
    </section>
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

function formatLocationStatuses(photo: UploadedPhoto): string[] {
  if (photo.locationSource === 'exif') {
    return ['Status: GPS mapped']
  }

  if (photo.locationSource === 'manual') {
    return photo.gpsStatus === 'metadata_error' || photo.error
      ? ['Status: User assigned', 'Original status: Metadata error']
      : ['Status: User assigned']
  }

  if (photo.gpsStatus === 'metadata_error' || photo.error) {
    return ['Status: Metadata error']
  }

  return ['Status: Missing GPS']
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
  photoNumber: number
  isSelected: boolean
  isProcessing: boolean
  onSelectPhoto: (photo: UploadedPhoto) => void
  onStartLocationAssignment: (photo: UploadedPhoto) => void
  onRemoveAssignedLocation: (photo: UploadedPhoto) => void
}

function PhotoListItem({
  photo,
  photoNumber,
  isSelected,
  isProcessing,
  onSelectPhoto,
  onStartLocationAssignment,
  onRemoveAssignedLocation,
}: PhotoListItemProps) {
  const hasLocation = hasUsableCoordinates(photo)
  const canManageLocation = isSelected && photo.locationSource !== 'exif'

  return (
    <div className="photo-list-entry">
      <button type="button" className="photo-list-item" onClick={() => onSelectPhoto(photo)}>
        <span className="photo-thumb-wrap">
          <span className="photo-number-badge" aria-label={`Photo ${photoNumber}`}>
            {photoNumber}
          </span>
          {photo.previewUrl ? (
            <img src={photo.previewUrl} alt="" />
          ) : (
            <span className="list-thumb-placeholder" title={photo.previewUnavailableReason ?? undefined}>
              {photo.isHeic ? 'HEIC' : <ImageIcon size={18} />}
            </span>
          )}
          {photo.locationSource === 'manual' ? (
            <span className="manual-marker-badge" aria-label="User assigned location">
              M
            </span>
          ) : null}
        </span>
        <span>
          <strong>{photo.fileName}</strong>
          <small className={`preview-status preview-status-${photo.previewStatus}`}>{photo.previewMessage}</small>
          {formatLocationStatuses(photo).map((status) => (
            <small key={status}>{status}</small>
          ))}
          <small>
            {hasLocation
              ? `${photo.latitude!.toFixed(6)}, ${photo.longitude!.toFixed(6)}`
              : photo.error ?? 'GPS metadata not found'}
          </small>
        </span>
      </button>
      {canManageLocation ? (
        <div className="photo-location-actions">
          <button
            type="button"
            className="photo-location-button"
            disabled={isProcessing}
            onClick={() => onStartLocationAssignment(photo)}
          >
            Assign / Modify Location
          </button>
          {photo.locationSource === 'manual' ? (
            <button
              type="button"
              className="photo-location-button"
              disabled={isProcessing}
              onClick={() => onRemoveAssignedLocation(photo)}
            >
              Remove Location
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
