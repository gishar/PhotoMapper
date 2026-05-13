import type { PreviewStatus } from '../types'
import { HEIC_PREVIEW_UNSUPPORTED_MESSAGE, isBrowserDisplayableImage, isHeicFile } from './fileTypes'

export interface PreviewImageResult {
  previewUrl: string | null
  previewStatus: PreviewStatus
  previewMessage: string
  objectUrlsToRevoke: string[]
}

export async function createPreviewImage(file: File): Promise<PreviewImageResult> {
  if (isBrowserDisplayableImage(file)) {
    const previewUrl = URL.createObjectURL(file)

    return {
      previewUrl,
      previewStatus: 'native',
      previewMessage: 'Native preview',
      objectUrlsToRevoke: [previewUrl],
    }
  }

  if (isHeicFile(file)) {
    return createHeicPreview(file)
  }

  return createCanvasFallbackPreview(file)
}

export function revokeObjectUrls(urls: string[]): void {
  urls.forEach((url) => URL.revokeObjectURL(url))
}

async function createHeicPreview(file: File): Promise<PreviewImageResult> {
  try {
    // HEIC GPS extraction and HEIC browser preview support are separate issues.
    // Metadata is read from the original upload; this JPG exists only for display.
    const { default: heic2any } = await import('heic2any')
    const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.88 })
    const jpgBlob = Array.isArray(converted) ? converted[0] : converted

    if (!jpgBlob) {
      return failedPreview(HEIC_PREVIEW_UNSUPPORTED_MESSAGE)
    }

    const previewUrl = URL.createObjectURL(jpgBlob)

    return {
      previewUrl,
      previewStatus: 'converted',
      previewMessage: 'Converted to JPG for preview',
      objectUrlsToRevoke: [previewUrl],
    }
  } catch {
    return failedPreview(HEIC_PREVIEW_UNSUPPORTED_MESSAGE)
  }
}

async function createCanvasFallbackPreview(file: File): Promise<PreviewImageResult> {
  const sourceUrl = URL.createObjectURL(file)

  try {
    const image = await loadImage(sourceUrl)
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight

    const context = canvas.getContext('2d')
    if (!context) {
      return failedPreview('Preview unavailable')
    }

    context.drawImage(image, 0, 0)
    const jpgBlob = await canvasToJpegBlob(canvas)
    if (!jpgBlob) {
      return failedPreview('Preview unavailable')
    }

    const previewUrl = URL.createObjectURL(jpgBlob)

    return {
      previewUrl,
      previewStatus: 'converted',
      previewMessage: 'Converted to JPG for preview',
      objectUrlsToRevoke: [previewUrl],
    }
  } catch {
    return failedPreview('Preview unavailable')
  } finally {
    URL.revokeObjectURL(sourceUrl)
  }
}

function failedPreview(message: string): PreviewImageResult {
  return {
    previewUrl: null,
    previewStatus: 'failed',
    previewMessage: message,
    objectUrlsToRevoke: [],
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Browser cannot display this image format.'))
    image.src = src
  })
}

function canvasToJpegBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.88)
  })
}
