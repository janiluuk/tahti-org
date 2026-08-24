// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/**
 * Independent client for hearthis.at's public JSON API (api-v2.hearthis.at).
 *
 * hearthis.at has no official published API reference — this module was built
 * by directly probing the live API and recording verified response shapes.
 * Endpoints below are marked VERIFIED (hit live, shape recorded from a real
 * response) or INFERRED (matches the `uri`/`related` resource-URL patterns
 * embedded in verified responses, and lines up with third-party wrapper
 * libraries, but hasn't been exercised against live traffic here — confirm
 * before depending on it for anything user-facing).
 *
 * Like @tahti/mixcloud's read side (see packages/shared/src/mixcloud-catalog.ts):
 * we never fetch or re-host hearthis.at audio here. `stream_url` is hearthis.at's
 * own playback URL, returned for reference/preview only; imports store a link
 * (embedUri), not a copy of the file — same posture as the existing Mixcloud/
 * Spotify "mixed-source collections" embeds.
 *
 * Auth: hearthis.at's read endpoints (search, feed, profiles, tracks) are public
 * and work with no credentials. `key`/`secret` are accepted on requests to
 * personalize results (e.g. "is this track favorited by me") — optional here.
 */

const DEFAULT_BASE_URL = 'https://api-v2.hearthis.at'

export interface HearthisClientOptions {
  baseUrl?: string
  apiKey?: string
  apiSecret?: string
  fetch?: typeof fetch
}

export interface HearthisCategory {
  id: string
  name: string
  url: string
  api_url: string
  background_color?: string
}

export interface HearthisUserRef {
  id: string
  permalink: string
  username: string
  caption?: string
  uri: string
  permalink_url: string
  avatar_url?: string
  following?: boolean
}

export interface HearthisUserProfile extends HearthisUserRef {
  description?: string
  geo?: string
  track_count?: string
  playlist_count?: string
  likes_count?: string
  followers_count?: string
  avatar_url_retina?: string
  background_url?: string
}

export interface HearthisTrack {
  id: string
  title: string
  permalink: string
  permalink_url: string
  uri: string
  description?: string
  duration: string
  genre?: string
  tags?: string
  bpm?: string
  downloadable: string
  created_at: string
  release_date: string
  thumb?: string
  thumb_hires?: string
  artwork_url?: string
  artwork_url_retina?: string
  waveform_url?: string
  waveform_data_json?: string
  user: HearthisUserRef
  counts?: {
    plays: number
    downloads: number
    favoritings: number
    reshares: number
    comments: number
  }
  stream_url: string
  preview_url?: string
  download_url?: string
  download_filename?: string
  playback_count?: number
  favoritings_count?: number
  comment_count?: number
  is_live?: boolean
}

export interface HearthisSearchParams {
  page?: number
  count?: number
  /** empty = all types */
  type?: '' | 'track' | 'user' | 'playlist'
}

export interface HearthisFeedParams {
  page?: number
  count?: number
  duration?: 'short' | 'medium' | 'long' | ''
  type?: '' | 'popular' | 'new'
  category?: string
}

function parseHearthisTrackUrl(input: string): { user: string; track: string } | null {
  try {
    const url = new URL(input)
    if (!/(^|\.)hearthis\.at$/.test(url.hostname)) return null
    const match = /^\/([^/]+)\/([^/]+)\/?$/.exec(url.pathname)
    return match ? { user: match[1], track: match[2] } : null
  } catch {
    return null
  }
}

/** Normalizes a pasted hearthis.at profile URL or bare handle to a permalink. Null if malformed. */
export function parseHearthisUsername(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  try {
    const url = new URL(trimmed)
    if (!/(^|\.)hearthis\.at$/.test(url.hostname)) return null
    const match = /^\/([^/]+)\/?$/.exec(url.pathname)
    return match ? match[1] : null
  } catch {
    return /^[A-Za-z0-9_-]+$/.test(trimmed) ? trimmed : null
  }
}

export interface HearthisClient {
  /** VERIFIED — GET /categories/ */
  listCategories(): Promise<HearthisCategory[]>
  /** VERIFIED — GET /feed/?type=&count=&page=&category= (global browse, not search) */
  getFeed(params?: HearthisFeedParams): Promise<HearthisTrack[]>
  /** VERIFIED — GET /{permalink}/ */
  getUser(permalink: string): Promise<HearthisUserProfile>
  /** INFERRED from the `uri` field on every verified track object (`.../{user}/{track}/`). */
  getTrack(userPermalink: string, trackPermalink: string): Promise<HearthisTrack>
  /** Convenience: parses a pasted hearthis.at track URL and resolves it via getTrack. */
  getTrackByUrl(trackUrl: string): Promise<HearthisTrack>
  /** INFERRED — community wrappers document q/type params; response shape assumed to match feed/. */
  search(query: string, params?: HearthisSearchParams): Promise<HearthisTrack[]>
  /** VERIFIED — GET /{permalink}/?type=tracks (NOT /{permalink}/tracks/, which 404s as
   * `{"status":"error","message":"Content Gone"}` — confirmed live against hearthis.at/yaniho). */
  getUserTracks(
    permalink: string,
    params?: { page?: number; count?: number },
  ): Promise<HearthisTrack[]>
}

export function createHearthisClient(options: HearthisClientOptions = {}): HearthisClient {
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL
  const doFetch = options.fetch ?? fetch

  function buildUrl(path: string, params: Record<string, string | number | undefined> = {}): URL {
    const url = new URL(path, baseUrl)
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, String(value))
    }
    if (options.apiKey) url.searchParams.set('key', options.apiKey)
    if (options.apiSecret) url.searchParams.set('secret', options.apiSecret)
    return url
  }

  async function get<T>(
    path: string,
    params?: Record<string, string | number | undefined>,
  ): Promise<T> {
    const res = await doFetch(buildUrl(path, params).toString())
    if (!res.ok) throw new Error(`hearthis.at API request failed (${res.status}): ${path}`)
    const data = (await res.json()) as
      T | { success: false; message: string } | { status: 'error'; message: string }
    // The API uses two different shapes for in-band errors depending on the
    // endpoint: {success:false,...} (e.g. search rate limits) and
    // {status:"error",...} (e.g. a permalink that no longer resolves).
    if (data && typeof data === 'object') {
      if ('success' in data && data.success === false) {
        throw new Error(`hearthis.at API error: ${data.message}`)
      }
      if ('status' in data && data.status === 'error') {
        throw new Error(`hearthis.at API error: ${data.message}`)
      }
    }
    return data as T
  }

  return {
    listCategories: () => get<HearthisCategory[]>('/categories/'),

    getFeed: (params = {}) =>
      get<HearthisTrack[]>('/feed/', {
        page: params.page,
        count: params.count,
        duration: params.duration,
        type: params.type ?? '',
        category: params.category,
      }),

    getUser: (permalink) => get<HearthisUserProfile>(`/${encodeURIComponent(permalink)}/`),

    getTrack: (userPermalink, trackPermalink) =>
      get<HearthisTrack>(
        `/${encodeURIComponent(userPermalink)}/${encodeURIComponent(trackPermalink)}/`,
      ),

    getTrackByUrl(trackUrl) {
      const parsed = parseHearthisTrackUrl(trackUrl)
      if (!parsed) return Promise.reject(new Error(`Not a hearthis.at track URL: ${trackUrl}`))
      return this.getTrack(parsed.user, parsed.track)
    },

    search: (query, params = {}) =>
      get<HearthisTrack[]>('/search/', {
        q: query,
        type: params.type ?? 'track',
        page: params.page,
        count: params.count,
      }),

    getUserTracks: (permalink, params = {}) =>
      get<HearthisTrack[]>(`/${encodeURIComponent(permalink)}/`, {
        type: 'tracks',
        page: params.page,
        count: params.count,
      }),
  }
}

// --- Write side: login + upload ------------------------------------------
//
// VERIFIED 2026-08-24 against the live account docs at hearthis.at/api/
// (Premium-gated — logged in with a real Premium account to read them) and a
// real upload/login round-trip. Two hosts: api-v2.hearthis.at for auth,
// xhr.hearthis.at for upload/edit/delete, all of which additionally require
// an active Premium account (anonymous → 401, logged-in free → 403).

const UPLOAD_BASE_URL = 'https://xhr.hearthis.at'

/** The `key`/`secret` pair returned by loginToHearthis — the docs call these
 * masterkey/verify_code, but the live response field names are `key`/`secret`.
 * Durable, not a session token: "possession of a valid key/secret pair is
 * the authorization" (no separate CSRF/session concept). */
export interface HearthisAuth {
  key: string
  secret: string
}

export interface HearthisLoginResult {
  auth: HearthisAuth
  premium: boolean
  userId: string
  username: string
  permalink: string
}

/** Thrown by loginToHearthis for a wrong email/password (never for a
 * non-Premium account — login itself doesn't require Premium, only writes do). */
export class HearthisLoginError extends Error {}

/** VERIFIED — GET /login/ on api-v2.hearthis.at. `email`+`password` in,
 * account object with `key`/`secret`/`premium` out. The same endpoint takes
 * `action=register`+`username` to create an account instead, per the docs —
 * intentionally not wrapped here: Tahti links out to hearthis.at/signup/
 * rather than creating accounts on a third-party service on a user's behalf. */
export async function loginToHearthis(
  email: string,
  password: string,
  options: { baseUrl?: string; fetch?: typeof fetch } = {},
): Promise<HearthisLoginResult> {
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL
  const doFetch = options.fetch ?? fetch
  const url = new URL('/login/', baseUrl)
  url.searchParams.set('email', email)
  url.searchParams.set('password', password)

  const res = await doFetch(url.toString())
  const data = (await res.json().catch(() => null)) as {
    key?: string
    secret?: string
    premium?: boolean
    id?: string
    username?: string
    permalink?: string
    message?: string
  } | null

  if (!res.ok || !data?.key || !data.secret) {
    throw new HearthisLoginError(
      data?.message ?? 'hearthis.at login failed — check the email and password.',
    )
  }

  return {
    auth: { key: data.key, secret: data.secret },
    premium: Boolean(data.premium),
    userId: data.id ?? '',
    username: data.username ?? '',
    permalink: data.permalink ?? '',
  }
}

export interface HearthisUploadInput {
  title: string
  audioBuffer: Buffer
  filename: string
}

export interface HearthisUploadResult {
  remoteId: string
  url?: string
}

/** Thrown by uploadTrackToHearthis when the account's key/secret are valid
 * but it isn't (or is no longer) Premium — distinct from a hard auth/network
 * failure so callers can show "upgrade to Premium" instead of a generic error. */
export class HearthisPremiumRequiredError extends Error {}

/** VERIFIED — POST /upload_api.php on xhr.hearthis.at. Multipart field is
 * `file` (not `mp3`); auth is `key`/`secret` query params, not a form field.
 * Metadata fields (genre, tags, tracklist, description, ...) are all optional
 * and accepted in the same call — only title is sent here, matching what
 * Tahti tracks metadata Tahti itself. */
export async function uploadTrackToHearthis(
  auth: HearthisAuth,
  input: HearthisUploadInput,
  options: { baseUrl?: string; fetch?: typeof fetch } = {},
): Promise<HearthisUploadResult> {
  const baseUrl = options.baseUrl ?? UPLOAD_BASE_URL
  const doFetch = options.fetch ?? fetch
  const url = new URL('/upload_api.php', baseUrl)
  url.searchParams.set('key', auth.key)
  url.searchParams.set('secret', auth.secret)

  const form = new FormData()
  form.set('file', new Blob([Uint8Array.from(input.audioBuffer)]), input.filename)
  form.set('title', input.title)

  const res = await doFetch(url.toString(), { method: 'POST', body: form })
  const data = (await res.json().catch(() => null)) as {
    files?: Array<{
      id?: string
      error?: string
      full?: { permalink_url?: string }
    }>
  } | null
  const file = data?.files?.[0]
  const errorMessage = file?.error || (!res.ok ? `hearthis.at upload failed: ${res.status}` : '')

  if (errorMessage) {
    if (res.status === 403) throw new HearthisPremiumRequiredError(errorMessage)
    throw new Error(errorMessage)
  }
  if (!file?.id) throw new Error('hearthis.at upload response had no track id')

  return { remoteId: file.id, url: file.full?.permalink_url }
}
