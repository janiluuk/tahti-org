// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import {
  EMBED_COVER_LOOKUP_TIMEOUT_MS,
  lookupEmbedProviderCover,
  type EmbedCoverOptions,
} from '@tahti/shared'

const OEMBED_ENDPOINTS: Array<[RegExp, string]> = [
  [/^(www\.|m\.)?soundcloud\.com$/, 'https://soundcloud.com/oembed?format=json&url='],
  [/^((www\.|m\.)?youtube\.com|youtu\.be)$/, 'https://www.youtube.com/oembed?format=json&url='],
]

const CACHE_TTL_MS = 6 * 60 * 60 * 1000
const CACHE_MAX = 1000
const cache = new Map<string, { value: string | null; expiresAt: number }>()

export function clearEmbedThumbnailCache() {
  cache.clear()
}

function providerFor(host: string): 'HEARTHIS' | 'MIXCLOUD' | 'SPOTIFY' | 'BANDCAMP' | null {
  if (/(^|\.)hearthis\.at$/.test(host)) return 'HEARTHIS'
  if (/(^|\.)mixcloud\.com$/.test(host)) return 'MIXCLOUD'
  if (host === 'open.spotify.com') return 'SPOTIFY'
  if (/(^|\.)bandcamp\.com$/.test(host)) return 'BANDCAMP'
  return null
}

export function isSupportedEmbedPage(pageUrl: string): boolean {
  let url: URL
  try {
    url = new URL(pageUrl)
  } catch {
    return false
  }
  if (url.protocol !== 'https:') return false
  const host = url.hostname.toLowerCase()
  return OEMBED_ENDPOINTS.some(([pattern]) => pattern.test(host)) || providerFor(host) !== null
}

async function oembedThumbnail(
  endpoint: string,
  pageUrl: string,
  options: EmbedCoverOptions,
): Promise<string | null> {
  const doFetch = options.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args))
  try {
    const res = await doFetch(`${endpoint}${encodeURIComponent(pageUrl)}`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(options.timeoutMs ?? EMBED_COVER_LOOKUP_TIMEOUT_MS),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { thumbnail_url?: unknown }
    const thumb = typeof data.thumbnail_url === 'string' ? data.thumbnail_url.trim() : ''
    return thumb.startsWith('https://') ? thumb : null
  } catch {
    return null
  }
}

async function lookup(url: URL, options: EmbedCoverOptions): Promise<string | null> {
  const host = url.hostname.toLowerCase()
  const oembed = OEMBED_ENDPOINTS.find(([pattern]) => pattern.test(host))
  if (oembed) return oembedThumbnail(oembed[1], url.toString(), options)
  const provider = providerFor(host)
  if (!provider) return null
  return lookupEmbedProviderCover(
    { embedProvider: provider, embedUri: null, embedSourceUrl: url.toString() },
    options,
  )
}

export async function lookupEmbedThumbnail(
  pageUrl: string,
  options: EmbedCoverOptions & { now?: () => number } = {},
): Promise<string | null> {
  if (!isSupportedEmbedPage(pageUrl)) return null
  const url = new URL(pageUrl)
  url.hash = ''
  const key = url.toString()
  const now = options.now ?? Date.now
  const cached = cache.get(key)
  if (cached && cached.expiresAt > now()) return cached.value
  const value = await lookup(url, options)
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  cache.set(key, { value, expiresAt: now() + CACHE_TTL_MS })
  return value
}
