const GOOGLE_API_SCRIPT_URL = 'https://apis.google.com/js/api.js'
const GOOGLE_IDENTITY_SCRIPT_URL = 'https://accounts.google.com/gsi/client'
const GOOGLE_DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.readonly'
const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/heif']

interface GoogleDriveConfig {
  apiKey: string
  clientId: string
  appId?: string
}

interface TokenResponse {
  access_token?: string
  error?: string
}

interface PickerDocument {
  id: string
  name?: string
  mimeType?: string
  resourceKey?: string
}

interface PickerResponse {
  action: string
  docs?: PickerDocument[]
}

interface DriveFileMetadata {
  name?: string
  mimeType?: string
  modifiedTime?: string
}

interface GoogleTokenClient {
  requestAccessToken: (options?: { prompt?: string }) => void
}

interface GooglePickerBuilder {
  addView: (view: GoogleDocsView) => GooglePickerBuilder
  enableFeature: (feature: string) => GooglePickerBuilder
  setAppId: (appId: string) => GooglePickerBuilder
  setCallback: (callback: (response: PickerResponse) => void) => GooglePickerBuilder
  setDeveloperKey: (apiKey: string) => GooglePickerBuilder
  setOAuthToken: (token: string) => GooglePickerBuilder
  build: () => { setVisible: (visible: boolean) => void }
}

interface GoogleDocsView {
  setIncludeFolders: (includeFolders: boolean) => GoogleDocsView
  setMimeTypes: (mimeTypes: string) => GoogleDocsView
  setSelectFolderEnabled: (enabled: boolean) => GoogleDocsView
}

interface GoogleApi {
  load: (apiName: string, options: { callback: () => void; onerror: () => void }) => void
}

interface GoogleGlobal {
  accounts: {
    oauth2: {
      initTokenClient: (config: {
        client_id: string
        callback: (response: TokenResponse) => void
        error_callback?: () => void
        scope: string
      }) => GoogleTokenClient
    }
  }
  picker: {
    Action: { CANCEL: string; PICKED: string }
    DocsView: new (viewId: string) => GoogleDocsView
    Feature: { MULTISELECT_ENABLED: string }
    PickerBuilder: new () => GooglePickerBuilder
    ViewId: { DOCS: string }
  }
}

declare global {
  interface Window {
    gapi?: GoogleApi
    google?: GoogleGlobal
  }
}

export class GoogleDriveImportError extends Error {}

export async function importGoogleDrivePhotos(): Promise<File[] | null> {
  const config = getGoogleDriveConfig()

  if (!config) {
    throw new GoogleDriveImportError('Google Drive import is not configured yet.')
  }

  await Promise.all([loadScript(GOOGLE_API_SCRIPT_URL), loadScript(GOOGLE_IDENTITY_SCRIPT_URL)])
  await loadPickerApi()

  const accessToken = await requestAccessToken(config.clientId)
  const documents = await pickDriveImages(config, accessToken)

  if (documents === null) {
    return null
  }

  const imageDocuments = documents.filter((document) => isUsableImage(document.mimeType))

  if (imageDocuments.length === 0) {
    throw new GoogleDriveImportError('No usable image files were selected.')
  }

  return Promise.all(imageDocuments.map((document) => downloadDriveFile(document, accessToken)))
}

function getGoogleDriveConfig(): GoogleDriveConfig | null {
  const apiKey = import.meta.env.VITE_GOOGLE_DRIVE_API_KEY
  const clientId = import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_ID
  const appId = import.meta.env.VITE_GOOGLE_DRIVE_APP_ID

  if (!apiKey || !clientId) {
    return null
  }

  return { apiKey, clientId, appId }
}

function loadScript(src: string): Promise<void> {
  const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`)

  if (existingScript) {
    return Promise.resolve()
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script')

    script.src = src
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new GoogleDriveImportError('Google Drive import failed to load.'))
    document.head.appendChild(script)
  })
}

function loadPickerApi(): Promise<void> {
  if (!window.gapi) {
    return Promise.reject(new GoogleDriveImportError('Google Drive import failed to load.'))
  }

  return new Promise((resolve, reject) => {
    window.gapi?.load('picker', {
      callback: resolve,
      onerror: () => reject(new GoogleDriveImportError('Google Drive picker failed to load.')),
    })
  })
}

function requestAccessToken(clientId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const tokenClient = window.google?.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: GOOGLE_DRIVE_SCOPE,
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(new GoogleDriveImportError('Google Drive authorization failed.'))
          return
        }

        resolve(response.access_token)
      },
      error_callback: () => reject(new GoogleDriveImportError('Google Drive authorization failed.')),
    })

    if (!tokenClient) {
      reject(new GoogleDriveImportError('Google Drive authorization failed.'))
      return
    }

    tokenClient.requestAccessToken({ prompt: '' })
  })
}

function pickDriveImages(config: GoogleDriveConfig, accessToken: string): Promise<PickerDocument[] | null> {
  return new Promise((resolve, reject) => {
    const picker = window.google?.picker

    if (!picker) {
      reject(new GoogleDriveImportError('Google Drive picker failed to load.'))
      return
    }

    const view = new picker.DocsView(picker.ViewId.DOCS)
      .setIncludeFolders(true)
      .setMimeTypes(IMAGE_MIME_TYPES.join(','))
      .setSelectFolderEnabled(false)
    const builder = new picker.PickerBuilder()
      .addView(view)
      .enableFeature(picker.Feature.MULTISELECT_ENABLED)
      .setDeveloperKey(config.apiKey)
      .setOAuthToken(accessToken)
      .setCallback((response) => {
        if (response.action === picker.Action.CANCEL) {
          resolve(null)
          return
        }

        if (response.action === picker.Action.PICKED) {
          resolve(response.docs ?? [])
        }
      })

    if (config.appId) {
      builder.setAppId(config.appId)
    }

    builder.build().setVisible(true)
  })
}

async function downloadDriveFile(document: PickerDocument, accessToken: string): Promise<File> {
  const metadata = await fetchDriveMetadata(document, accessToken)
  const mimeType = metadata.mimeType ?? document.mimeType ?? ''

  if (!isUsableImage(mimeType)) {
    throw new GoogleDriveImportError('One or more selected Google Drive files are not usable image files.')
  }

  const params = new URLSearchParams({
    alt: 'media',
    supportsAllDrives: 'true',
  })
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(document.id)}?${params.toString()}`,
    {
      headers: buildDriveHeaders(accessToken, document),
    },
  )

  if (!response.ok) {
    throw new GoogleDriveImportError(`Failed to download ${metadata.name ?? document.name ?? 'a Google Drive photo'}.`)
  }

  const blob = await response.blob()
  const fileName = metadata.name ?? document.name ?? 'google-drive-photo'
  const lastModified = metadata.modifiedTime ? Date.parse(metadata.modifiedTime) : Date.now()

  return new File([blob], fileName, {
    type: blob.type || mimeType,
    lastModified: Number.isFinite(lastModified) ? lastModified : Date.now(),
  })
}

async function fetchDriveMetadata(document: PickerDocument, accessToken: string): Promise<DriveFileMetadata> {
  const params = new URLSearchParams({
    fields: 'name,mimeType,modifiedTime',
    supportsAllDrives: 'true',
  })
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(document.id)}?${params.toString()}`,
    {
      headers: buildDriveHeaders(accessToken, document),
    },
  )

  if (!response.ok) {
    throw new GoogleDriveImportError('Failed to read Google Drive photo details.')
  }

  return response.json() as Promise<DriveFileMetadata>
}

function buildDriveHeaders(accessToken: string, document: PickerDocument): HeadersInit {
  const headers: Record<string, string> = { Authorization: `Bearer ${accessToken}` }

  if (document.resourceKey) {
    headers['X-Goog-Drive-Resource-Keys'] = `${document.id}/${document.resourceKey}`
  }

  return headers
}

function isUsableImage(mimeType: string | undefined): boolean {
  return Boolean(mimeType && IMAGE_MIME_TYPES.includes(mimeType))
}
