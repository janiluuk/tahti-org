// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/** Least-privilege scope: files the user picks via Google Picker only. */
export const GOOGLE_DRIVE_OAUTH_SCOPE = 'https://www.googleapis.com/auth/drive.file'

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files'

const AUDIO_MIME_PREFIX = 'audio/'
const AUDIO_EXTENSIONS = new Set([
  'mp3',
  'wav',
  'flac',
  'aac',
  'm4a',
  'ogg',
  'opus',
  'webm',
  'aiff',
  'aif',
])

export interface GoogleDriveOAuthConfig {
  clientId: string
  clientSecret: string
}

export interface GoogleDriveTokenResponse {
  access_token: string
  expires_in: number
  refresh_token?: string
  token_type: string
}

export interface GoogleDriveFileMetadata {
  id: string
  name: string
  mimeType: string
  size?: string
}

export function isAllowedDriveAudioMime(mimeType: string | undefined, fileName: string): boolean {
  if (mimeType?.startsWith(AUDIO_MIME_PREFIX)) return true
  const ext = fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() : undefined
  return Boolean(ext && AUDIO_EXTENSIONS.has(ext))
}

export function titleFromDriveFileName(fileName: string): string {
  const base = fileName.includes('.') ? fileName.slice(0, fileName.lastIndexOf('.')) : fileName
  return base.trim() || fileName
}

export function extensionFromDriveFile(fileName: string, mimeType?: string): string {
  if (fileName.includes('.')) {
    const ext = fileName.split('.').pop()?.toLowerCase()
    if (ext && AUDIO_EXTENSIONS.has(ext)) return ext
  }
  switch (mimeType) {
    case 'audio/mpeg':
    case 'audio/mp3':
      return 'mp3'
    case 'audio/wav':
    case 'audio/x-wav':
    case 'audio/vnd.wave':
      return 'wav'
    case 'audio/flac':
    case 'audio/x-flac':
      return 'flac'
    case 'audio/mp4':
    case 'audio/aac':
      return 'm4a'
    case 'audio/ogg':
      return 'ogg'
    case 'audio/webm':
      return 'webm'
    default:
      return 'mp3'
  }
}

export async function exchangeGoogleDriveCode(
  config: GoogleDriveOAuthConfig,
  code: string,
  redirectUri: string,
): Promise<GoogleDriveTokenResponse> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: redirectUri,
      code,
    }),
  })
  if (!res.ok) throw new Error('Google token exchange failed')
  const data = (await res.json()) as GoogleDriveTokenResponse
  if (!data.access_token) throw new Error('No access token in Google response')
  return data
}

export async function refreshGoogleDriveToken(
  config: GoogleDriveOAuthConfig,
  refreshToken: string,
): Promise<GoogleDriveTokenResponse> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
    }),
  })
  if (!res.ok) throw new Error('Google token refresh failed')
  const data = (await res.json()) as GoogleDriveTokenResponse
  if (!data.access_token) throw new Error('No access token in Google refresh response')
  return data
}

export async function fetchGoogleDriveFileMetadata(
  accessToken: string,
  fileId: string,
): Promise<GoogleDriveFileMetadata> {
  const url = new URL(`${GOOGLE_DRIVE_FILES_URL}/${encodeURIComponent(fileId)}`)
  url.searchParams.set('fields', 'id,name,mimeType,size')
  url.searchParams.set('supportsAllDrives', 'true')
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    throw new Error(`Google Drive metadata failed (${res.status})`)
  }
  return (await res.json()) as GoogleDriveFileMetadata
}

export async function fetchGoogleDriveFileStream(
  accessToken: string,
  fileId: string,
): Promise<Response> {
  const url = new URL(`${GOOGLE_DRIVE_FILES_URL}/${encodeURIComponent(fileId)}`)
  url.searchParams.set('alt', 'media')
  url.searchParams.set('supportsAllDrives', 'true')
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    throw new Error(`Google Drive download failed (${res.status})`)
  }
  if (!res.body) throw new Error('Google Drive download returned empty body')
  return res
}
