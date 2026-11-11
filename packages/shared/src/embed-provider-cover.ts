// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

export type EmbedCoverSource = {
  embedProvider: string | null
  embedUri: string | null
  embedSourceUrl: string | null
}

export type EmbedCoverOptions = {
  fetch?: typeof fetch
  timeoutMs?: number
}

export const EMBED_COVER_LOOKUP_TIMEOUT_MS = 5_000
export const EMBED_COVER_LOOKUP_CAP = 25
export const EMBED_COVER_LOOKUP_BUDGET_MS = 20_000

type MixcloudPictures = Partial<
  Record<'640wx640h' | 'extra_large' | 'large' | 'medium' | 'thumbnail', string>
>

function trimmed(value: string | null | undefined): string | null {
  const text = value?.trim()
  return text ? text : null
}

function parseUrl(value: string | null): URL | null {
  if (!value) return null
  try {
    return new URL(value)
  } catch {
    return null
  }
}

export function hearthisTrackPath(pageUrl: string): string | null {
  const url = parseUrl(pageUrl)
  if (!url || !/(^|\.)hearthis\.at$/i.test(url.hostname)) return null
  const match = /^\/([^/]+)\/([^/]+)\/?$/.exec(url.pathname)
  return match ? `/${match[1]}/${match[2]}/` : null
}

export function mixcloudCloudcastKey(row: EmbedCoverSource): string | null {
  for (const candidate of [row.embedSourceUrl, row.embedUri]) {
    const url = parseUrl(trimmed(candidate))
    if (url && /(^|\.)mixcloud\.com$/i.test(url.hostname)) {
      const path = url.pathname.replace(/\/?$/, '/')
      if (/^\/[^/]+\/[^/]+\/$/.test(path)) return path
    }
  }
  const key = trimmed(row.embedUri)
  if (key && /^\/?[^/:]+\/[^/:]+\/?$/.test(key)) {
    return `/${key.replace(/^\/|\/$/g, '')}/`
  }
  return null
}

export function spotifyPageUrl(row: EmbedCoverSource): string | null {
  const source = parseUrl(trimmed(row.embedSourceUrl))
  if (source && source.hostname === 'open.spotify.com') return source.toString()
  const uri = trimmed(row.embedUri)
  if (!uri) return null
  const fromUri = uri.match(/^spotify:(track|album|playlist|episode|show):([A-Za-z0-9]+)$/)
  if (fromUri) return `https://open.spotify.com/${fromUri[1]}/${fromUri[2]}`
  const asUrl = parseUrl(uri)
  if (asUrl && asUrl.hostname === 'open.spotify.com') return asUrl.toString()
  if (/^[A-Za-z0-9]{22}$/.test(uri)) return `https://open.spotify.com/track/${uri}`
  return null
}

export function bandcampPageUrl(row: EmbedCoverSource): string | null {
  for (const candidate of [row.embedSourceUrl, row.embedUri]) {
    const url = parseUrl(trimmed(candidate))
    if (url && /(^|\.)bandcamp\.com$/i.test(url.hostname) && url.protocol === 'https:') {
      return url.toString()
    }
  }
  return null
}

function ogImage(html: string): string | null {
  const tag =
    html.match(/<meta[^>]+property=["']og:image["'][^>]*>/i)?.[0] ??
    html.match(/<meta[^>]+name=["']og:image["'][^>]*>/i)?.[0]
  const content = tag?.match(/content=["']([^"']+)["']/i)?.[1]
  return content && /^https:\/\//.test(content) ? content : null
}

async function getJson<T>(doFetch: typeof fetch, url: string): Promise<T | null> {
  const res = await doFetch(url, { headers: { accept: 'application/json' } })
  if (!res.ok) return null
  return (await res.json()) as T
}

async function hearthisCover(row: EmbedCoverSource, doFetch: typeof fetch) {
  const pageUrl = trimmed(row.embedSourceUrl)
  if (!pageUrl) return null
  const path = hearthisTrackPath(pageUrl)
  if (!path) return null
  const track = await getJson<{ artwork_url?: string | null; artwork_url_retina?: string | null }>(
    doFetch,
    `https://api-v2.hearthis.at${path}`,
  )
  return trimmed(track?.artwork_url_retina) ?? trimmed(track?.artwork_url)
}

async function mixcloudCover(row: EmbedCoverSource, doFetch: typeof fetch) {
  const key = mixcloudCloudcastKey(row)
  if (!key) return null
  const cast = await getJson<{ pictures?: MixcloudPictures }>(
    doFetch,
    `https://api.mixcloud.com${key}`,
  )
  const pictures = cast?.pictures
  return (
    pictures?.['640wx640h'] ?? pictures?.extra_large ?? pictures?.large ?? pictures?.medium ?? null
  )
}

async function spotifyCover(row: EmbedCoverSource, doFetch: typeof fetch) {
  const pageUrl = spotifyPageUrl(row)
  if (!pageUrl) return null
  const data = await getJson<{ thumbnail_url?: string }>(
    doFetch,
    `https://open.spotify.com/oembed?url=${encodeURIComponent(pageUrl)}`,
  )
  return trimmed(data?.thumbnail_url)
}

async function bandcampCover(row: EmbedCoverSource, doFetch: typeof fetch) {
  const pageUrl = bandcampPageUrl(row)
  if (!pageUrl) return null
  const res = await doFetch(pageUrl, { headers: { accept: 'text/html' } })
  if (!res.ok) return null
  return ogImage(await res.text())
}

/**
 * The provider's own cover for an embedded sound, or null when the provider
 * has none or the lookup fails. Mikseri is skipped: its embed page carries no
 * artwork and there is no public cover endpoint keyed by track id.
 */
export async function lookupEmbedProviderCover(
  row: EmbedCoverSource,
  options: EmbedCoverOptions = {},
): Promise<string | null> {
  const baseFetch = options.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args))
  const timeoutMs = options.timeoutMs ?? EMBED_COVER_LOOKUP_TIMEOUT_MS
  const doFetch: typeof fetch = (input, init) =>
    baseFetch(input, { ...init, signal: AbortSignal.timeout(timeoutMs) })
  try {
    if (bandcampPageUrl(row)) return await bandcampCover(row, doFetch)
    switch (row.embedProvider) {
      case 'HEARTHIS':
        return await hearthisCover(row, doFetch)
      case 'MIXCLOUD':
        return await mixcloudCover(row, doFetch)
      case 'SPOTIFY':
        return await spotifyCover(row, doFetch)
      default:
        return null
    }
  } catch {
    return null
  }
}

export function hasEmbedProviderCoverLookup(row: EmbedCoverSource): boolean {
  if (bandcampPageUrl(row)) return true
  switch (row.embedProvider) {
    case 'HEARTHIS':
      return trimmed(row.embedSourceUrl) !== null
    case 'MIXCLOUD':
      return mixcloudCloudcastKey(row) !== null
    case 'SPOTIFY':
      return spotifyPageUrl(row) !== null
    default:
      return false
  }
}

export type EmbedCoverBatchOptions = EmbedCoverOptions & {
  cap?: number
  budgetMs?: number
  now?: () => number
}

/**
 * Provider covers for up to `cap` rows, stopping early once `budgetMs` has
 * passed, so one backfill request never hangs on slow providers. Rows past
 * the cap or the budget are left for presets (or the next run).
 */
export async function resolveEmbedProviderCovers<T extends EmbedCoverSource & { id: string }>(
  rows: T[],
  options: EmbedCoverBatchOptions = {},
): Promise<{ covers: Map<string, string>; looked: number; skipped: number }> {
  const cap = options.cap ?? EMBED_COVER_LOOKUP_CAP
  const budgetMs = options.budgetMs ?? EMBED_COVER_LOOKUP_BUDGET_MS
  const now = options.now ?? Date.now
  const deadline = now() + budgetMs
  const covers = new Map<string, string>()
  const candidates = rows.filter(hasEmbedProviderCoverLookup)
  let looked = 0
  for (const row of candidates) {
    if (looked >= cap || now() >= deadline) break
    looked += 1
    const cover = await lookupEmbedProviderCover(row, options)
    if (cover) covers.set(row.id, cover)
  }
  return { covers, looked, skipped: candidates.length - looked }
}
