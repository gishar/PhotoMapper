import { useEffect } from 'react'
import { ChevronLeft, ChevronRight, ImageIcon, X } from 'lucide-react'
import type { UploadedPhoto } from '../types'

interface ImageModalProps {
  photo: UploadedPhoto | null
  hasPrevious: boolean
  hasNext: boolean
  onPrevious: () => void
  onNext: () => void
  onClose: () => void
}

export function ImageModal({ photo, hasPrevious, hasNext, onPrevious, onNext, onClose }: ImageModalProps) {
  useEffect(() => {
    if (!photo) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      } else if (event.key === 'ArrowLeft' && hasPrevious) {
        event.preventDefault()
        onPrevious()
      } else if (event.key === 'ArrowRight' && hasNext) {
        event.preventDefault()
        onNext()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [hasNext, hasPrevious, onClose, onNext, onPrevious, photo])

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
        <div className="modal-preview">
          <button
            type="button"
            className="modal-nav-button modal-nav-button-previous"
            aria-label="Previous photo"
            onClick={onPrevious}
            disabled={!hasPrevious}
          >
            <ChevronLeft size={28} />
          </button>
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
          <button
            type="button"
            className="modal-nav-button modal-nav-button-next"
            aria-label="Next photo"
            onClick={onNext}
            disabled={!hasNext}
          >
            <ChevronRight size={28} />
          </button>
        </div>
      </div>
    </div>
  )
}
