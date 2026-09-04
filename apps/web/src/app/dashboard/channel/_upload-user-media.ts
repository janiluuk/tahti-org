// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001'

export type UploadedUserMedia = {
  url: string
  contentType: string
  filename: string
}

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const BACKDROP_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
])

export function isVideoFile(file: File): boolean {
  if (file.type.startsWith('video/')) return true
  return /\.(mp4|webm)$/i.test(file.name)
}

export function isImageFile(file: File): boolean {
  if (IMAGE_TYPES.has(file.type)) return true
  return /\.(jpe?g|png|webp)$/i.test(file.name)
}

/** Generic image upload via `/api/me/media/*` (gallery slideshow images). */
export async function uploadUserImage(file: File): Promise<UploadedUserMedia> {
  const contentType = IMAGE_TYPES.has(file.type) ? file.type : 'image/jpeg'
  if (!IMAGE_TYPES.has(contentType)) {
    throw new Error('Images must be JPEG, PNG, or WebP')
  }
  const prep = await fetch(`${API_BASE}/api/me/media/prepare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ filename: file.name, contentType }),
  })
  if (!prep.ok) throw new Error('Could not prepare image upload')
  const prepared = (await prep.json()) as { uploadKey: string; uploadUrl: string }
  const put = await fetch(prepared.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: file,
  })
  if (!put.ok) throw new Error('Image upload failed')
  const complete = await fetch(`${API_BASE}/api/me/media/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      uploadKey: prepared.uploadKey,
      filename: file.name,
      contentType,
      sizeBytes: file.size,
    }),
  })
  if (!complete.ok) throw new Error('Could not finish image upload')
  const result = (await complete.json()) as { url: string }
  return { url: result.url, contentType, filename: file.name }
}

/** Header backdrop slot — images or short video loops via `/api/me/channel/video-background/*`. */
export async function uploadChannelBackdrop(file: File): Promise<UploadedUserMedia> {
  let contentType = file.type
  if (!BACKDROP_TYPES.has(contentType)) {
    if (/\.mp4$/i.test(file.name)) contentType = 'video/mp4'
    else if (/\.webm$/i.test(file.name)) contentType = 'video/webm'
    else if (/\.gif$/i.test(file.name)) contentType = 'image/gif'
    else if (/\.png$/i.test(file.name)) contentType = 'image/png'
    else if (/\.webp$/i.test(file.name)) contentType = 'image/webp'
    else contentType = 'image/jpeg'
  }
  if (!BACKDROP_TYPES.has(contentType)) {
    throw new Error('Backdrop must be MP4, WebM, JPEG, PNG, WebP, or GIF (max 10 MB)')
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('Backdrop file must be 10 MB or smaller')
  }
  const prep = await fetch(`${API_BASE}/api/me/channel/video-background/prepare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      filename: file.name,
      contentType,
      fileSizeBytes: file.size,
    }),
  })
  if (!prep.ok) throw new Error('Could not prepare backdrop upload')
  const prepared = (await prep.json()) as { uploadKey: string; uploadUrl: string }
  const put = await fetch(prepared.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: file,
  })
  if (!put.ok) throw new Error('Backdrop upload failed')
  const complete = await fetch(`${API_BASE}/api/me/channel/video-background/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ uploadKey: prepared.uploadKey }),
  })
  if (!complete.ok) throw new Error('Could not finish backdrop upload')
  const result = (await complete.json()) as { videoBackgroundUrl: string }
  return { url: result.videoBackgroundUrl, contentType, filename: file.name }
}
