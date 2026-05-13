import { useEffect } from 'react'
import { ImageIcon, X } from 'lucide-react'
import type { UploadedPhoto } from '../types'

interface ImageModalProps {
  photo: UploadedPhoto | null
  onClose: () => void
}

export function ImageModal({ photo, onClose }: ImageModalProps) {
  useEffect(() => {
    if (!photo) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, photo])

  if (!photo) {
    return null
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="image-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <span>
            <strong>{photo.fileName}</strong>
            <small className={`preview-status preview-status-${photo.previewStatus}`}>{photo.previewMessage}</small>
          </span>
          <button type="button" className="icon-button" aria-label="Close image" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        {photo.previewUrl ? (
          <img src={photo.previewUrl} alt={photo.fileName} onClick={onClose} />
        ) : (
          <button type="button" className="modal-placeholder" onClick={onClose}>
            <ImageIcon size={36} />
            <span>{photo.previewMessage}</span>
            <small>
              {photo.latitude !== null && photo.longitude !== null
                ? `${photo.latitude.toFixed(8)}, ${photo.longitude.toFixed(8)}`
                : 'GPS metadata not found'}
            </small>
          </button>
        )}
      </div>
    </div>
  )
}
