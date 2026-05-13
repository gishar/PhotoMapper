export const HEIC_PREVIEW_UNSUPPORTED_MESSAGE =
  'HEIC preview not supported by this browser. GPS location was extracted successfully. Export this photo as JPG if preview is needed.'

const HEIC_EXTENSIONS = ['.heic', '.heif']
const HEIC_MIME_TYPES = ['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence']
const BROWSER_DISPLAYABLE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif']
const BROWSER_DISPLAYABLE_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']

export function isHeicFile(file: File): boolean {
  const fileName = file.name.toLowerCase()
  const mimeType = file.type.toLowerCase()

  return HEIC_EXTENSIONS.some((extension) => fileName.endsWith(extension)) || HEIC_MIME_TYPES.includes(mimeType)
}

export function isBrowserDisplayableImage(file: File): boolean {
  const fileName = file.name.toLowerCase()
  const mimeType = file.type.toLowerCase()

  return (
    BROWSER_DISPLAYABLE_EXTENSIONS.some((extension) => fileName.endsWith(extension)) ||
    BROWSER_DISPLAYABLE_MIME_TYPES.includes(mimeType)
  )
}
