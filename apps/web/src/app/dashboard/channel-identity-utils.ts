// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { AvatarTheme, LogoPlacement } from '@tahti/shared'
import { prepareAvatarUpload } from './channel-identity-actions'

const POSTER_SIZE = 512

export type ChannelIdentityDraft = {
  displayName: string
  avatarUrl: string | null
  avatarPosterUrl: string | null
  avatarTheme: AvatarTheme | null
  logoUrl: string | null
  logoPlacement: LogoPlacement | null
  countryCode: string | null
  pronouns: string | null
  defaultLocation: string | null
  genres: string[]
}

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase()
}

/** Draws a GIF's first frame onto a canvas and exports it as a JPEG blob —
 * the static poster shown at rest, since cropping a GIF through the normal
 * pan/zoom tool would flatten its animation (same canvas limitation
 * AvatarCropModal already has for the non-GIF path). */
export function extractPosterFrame(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = POSTER_SIZE
      canvas.height = POSTER_SIZE
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('Could not create canvas context'))
      const scale = Math.max(POSTER_SIZE / img.naturalWidth, POSTER_SIZE / img.naturalHeight)
      const w = img.naturalWidth * scale
      const h = img.naturalHeight * scale
      ctx.drawImage(img, (POSTER_SIZE - w) / 2, (POSTER_SIZE - h) / 2, w, h)
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Could not export poster frame'))),
        'image/jpeg',
        0.92,
      )
    }
    img.onerror = () => reject(new Error('Could not load that GIF'))
    img.src = URL.createObjectURL(file)
  })
}

export async function uploadBlob(
  blob: Blob,
  filename: string,
  contentType: string,
): Promise<{ uploadKey?: string; error?: string }> {
  const prep = await prepareAvatarUpload({ filename, contentType })
  if (prep.error || !prep.uploadUrl || !prep.uploadKey) {
    return { error: prep.error ?? 'Prepare failed' }
  }
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', prep.uploadUrl!)
    xhr.setRequestHeader('Content-Type', contentType)
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject())
    xhr.onerror = () => reject(new Error('Upload failed'))
    xhr.send(blob)
  })
  return { uploadKey: prep.uploadKey }
}
