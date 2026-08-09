import { useEffect, useState } from 'react'

const SHARE_TITLE = 'PhotoMapper'
const SHARE_TEXT = 'Map and organize field photos with PhotoMapper.'
const FALLBACK_SHARE_URL = 'https://photomapper.alestead.com'
const FEEDBACK_SUBJECT = 'PhotoMapper Feedback'

function getShareUrl(): string {
  return typeof window === 'undefined' ? FALLBACK_SHARE_URL : window.location.href
}

export function AppFooter() {
  const [shareMessage, setShareMessage] = useState<string | null>(null)
  const shareUrl = getShareUrl()

  useEffect(() => {
    if (!shareMessage) {
      return
    }

    const timerId = window.setTimeout(() => setShareMessage(null), 2200)
    return () => window.clearTimeout(timerId)
  }, [shareMessage])

  const copyShareUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setShareMessage('Link copied.')
    } catch {
      setShareMessage('Could not copy link.')
    }
  }

  const handleShareClick = async () => {
    setShareMessage(null)

    if (navigator.share) {
      try {
        await navigator.share({
          title: SHARE_TITLE,
          text: SHARE_TEXT,
          url: shareUrl,
        })
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }

        setShareMessage('Could not open share.')
      }

      return
    }

    await copyShareUrl()
  }

  return (
    <footer className="app-footer" aria-label="PhotoMapper footer">
      <span className="footer-phrase">
        Made by{' '}
        <a className="footer-link" href="https://alestead.com" target="_blank" rel="noopener noreferrer">
          Caspian Ale
        </a>
      </span>
      <span className="footer-separator" aria-hidden="true">
        &middot;
      </span>
      <span className="footer-phrase">
        Have an idea?{' '}
        <a className="footer-link" href={`mailto:gishar@gmail.com?subject=${encodeURIComponent(FEEDBACK_SUBJECT)}`}>
          Send feedback
        </a>
      </span>
      <span className="footer-separator" aria-hidden="true">
        &middot;
      </span>
      <button type="button" className="footer-link footer-share-button" onClick={handleShareClick}>
        Share this tool
      </button>
      {shareMessage ? (
        <span className="footer-copy-message" role="status" aria-live="polite">
          {shareMessage}
        </span>
      ) : null}
    </footer>
  )
}
