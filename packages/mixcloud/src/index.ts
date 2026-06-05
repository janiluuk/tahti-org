// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// Mixcloud Upload API client (M7).
// Mixcloud's upload API accepts a multipart form POST with the mix file and metadata.
// Requires OAuth 2 access token per artist (stored encrypted in artist settings).
//
// Real uploads call the network. When MIXCLOUD_CLIENT_ID is not set the client
// is in stub mode — useful for unit tests and CI without credentials.

import { readSecret } from './read-secret.js'

export interface MixcloudUploadParams {
  accessToken: string
  name: string
  description?: string
  audioPath: string // local file path
  picturePath?: string // optional cover art
  tags?: string[]
}

export interface MixcloudUploadResult {
  key: string // e.g. "/artistname/mix-title/"
  url: string // https://www.mixcloud.com/artistname/mix-title/
}

export async function uploadToMixcloud(
  params: MixcloudUploadParams,
): Promise<MixcloudUploadResult> {
  const clientId = process.env.MIXCLOUD_CLIENT_ID

  if (!clientId) {
    // Stub mode — return a fake result so CI/dev works without credentials
    return {
      key: `/stub/${Date.now()}/`,
      url: `https://www.mixcloud.com/stub/${Date.now()}/`,
    }
  }

  const FormData = (await import('node:buffer')).default

  // Mixcloud accepts standard multipart/form-data
  const form = new (globalThis.FormData ?? FormData)()
  form.append('name', params.name)
  if (params.description) form.append('description', params.description)
  if (params.tags) {
    params.tags.forEach((tag, i) => form.append(`tags-${i}-tag`, tag))
  }
  // Append the audio file as a stream
  const { Blob } = await import('node:buffer')
  const fs = await import('node:fs/promises')
  const audioBytes = await fs.readFile(params.audioPath)
  const audioBlob = new Blob([audioBytes], { type: 'audio/mpeg' })
  form.append('mp3', audioBlob as unknown as Blob, 'mix.mp3')

  if (params.picturePath) {
    const picBytes = await fs.readFile(params.picturePath)
    const picBlob = new Blob([picBytes], { type: 'image/jpeg' })
    form.append('picture', picBlob as unknown as Blob, 'cover.jpg')
  }

  const res = await fetch(
    `https://api.mixcloud.com/upload/?access_token=${params.accessToken}&client_id=${clientId}`,
    { method: 'POST', body: form as unknown as FormData },
  )

  const data = (await res.json()) as { result?: { key?: string }; error?: { message?: string } }

  if (!res.ok || !data.result?.key) {
    throw new Error(data.error?.message ?? `Mixcloud upload failed (${res.status})`)
  }

  const key = data.result.key
  return {
    key,
    url: `https://www.mixcloud.com${key}`,
  }
}

export function buildMixcloudAuthorizeUrl(clientId: string, redirectUri: string): string {
  const params = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri })
  return `https://www.mixcloud.com/oauth/authorize?${params}`
}

export interface MixcloudOAuthParams {
  code: string
  redirectUri: string
}

export interface MixcloudToken {
  accessToken: string
}

/** Exchange OAuth code for an access token. */
export async function exchangeMixcloudCode(params: MixcloudOAuthParams): Promise<MixcloudToken> {
  const clientId = process.env.MIXCLOUD_CLIENT_ID ?? ''
  const clientSecret = readSecret('MIXCLOUD_CLIENT_SECRET', 'MIXCLOUD_CLIENT_SECRET_FILE')

  if (!clientId || !clientSecret) {
    throw new Error('MIXCLOUD_CLIENT_ID and MIXCLOUD_CLIENT_SECRET must be set')
  }

  const res = await fetch('https://www.mixcloud.com/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: params.redirectUri,
      code: params.code,
    }),
  })

  const data = (await res.json()) as { access_token?: string; error?: string }
  if (!data.access_token) throw new Error(data.error ?? 'No access token returned')
  return { accessToken: data.access_token }
}
