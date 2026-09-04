// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { createHash } from 'node:crypto'

const LASTFM_API = 'https://ws.audioscrobbler.com/2.0/'
const LASTFM_AUTH = 'https://www.last.fm/api/auth'

export type LastFmCredentials = {
  apiKey: string
  apiSecret: string
}

export type LastFmScrobblePayload = {
  artistName: string
  trackName: string
  listenedAt: number
  albumName?: string
}

function md5Hex(value: string): string {
  return createHash('md5').update(value, 'utf8').digest('hex')
}

/** Last.fm api_sig = md5(concat of sorted key+value pairs + secret). */
export function signLastFmParams(
  params: Record<string, string>,
  apiSecret: string,
): string {
  const sortedKeys = Object.keys(params).sort()
  let raw = ''
  for (const key of sortedKeys) {
    raw += key + params[key]
  }
  raw += apiSecret
  return md5Hex(raw)
}

async function lastFmCall(
  credentials: LastFmCredentials,
  method: string,
  params: Record<string, string>,
  httpMethod: 'GET' | 'POST' = 'GET',
): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; error: string }> {
  const signed: Record<string, string> = {
    ...params,
    method,
    api_key: credentials.apiKey,
  }
  signed.api_sig = signLastFmParams(signed, credentials.apiSecret)
  signed.format = 'json'

  const url = new URL(LASTFM_API)
  let res: Response
  try {
    if (httpMethod === 'POST') {
      res = await fetch(url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(signed).toString(),
      })
    } else {
      for (const [key, value] of Object.entries(signed)) {
        url.searchParams.set(key, value)
      }
      res = await fetch(url.toString(), { method: 'GET' })
    }
  } catch {
    return { ok: false, error: 'Could not reach Last.fm' }
  }

  let body: Record<string, unknown>
  try {
    body = (await res.json()) as Record<string, unknown>
  } catch {
    return { ok: false, error: 'Invalid Last.fm response' }
  }

  if (!res.ok || body.error) {
    const message =
      typeof body.message === 'string'
        ? body.message
        : `Last.fm HTTP ${res.status}`
    return { ok: false, error: message }
  }

  return { ok: true, body }
}

export async function getLastFmAuthToken(
  credentials: LastFmCredentials,
): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const result = await lastFmCall(credentials, 'auth.getToken', {})
  if (!result.ok) return result
  const token = result.body.token
  if (typeof token !== 'string' || !token.trim()) {
    return { ok: false, error: 'Last.fm did not return an auth token' }
  }
  return { ok: true, token: token.trim() }
}

export function lastFmAuthUrl(
  apiKey: string,
  token: string,
  callbackUrl?: string,
): string {
  const url = new URL(LASTFM_AUTH)
  url.searchParams.set('api_key', apiKey)
  url.searchParams.set('token', token)
  if (callbackUrl) url.searchParams.set('cb', callbackUrl)
  return url.toString()
}

export async function getLastFmSession(
  credentials: LastFmCredentials,
  token: string,
): Promise<
  { ok: true; sessionKey: string; username: string } | { ok: false; error: string }
> {
  const trimmed = token.trim()
  if (!trimmed) return { ok: false, error: 'Missing Last.fm auth token' }

  const result = await lastFmCall(credentials, 'auth.getSession', { token: trimmed })
  if (!result.ok) return result

  const session = result.body.session as
    | { key?: string; name?: string }
    | undefined
  if (!session?.key || !session?.name) {
    return { ok: false, error: 'Last.fm session was not granted' }
  }
  return { ok: true, sessionKey: session.key, username: session.name }
}

export async function submitLastFmScrobble(
  credentials: LastFmCredentials,
  sessionKey: string,
  payload: LastFmScrobblePayload,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const sk = sessionKey.trim()
  if (!sk) return { ok: false, error: 'Missing Last.fm session key' }

  const artist = payload.artistName.trim()
  const track = payload.trackName.trim()
  if (!artist || !track) {
    return { ok: false, error: 'Missing artist or track for Last.fm scrobble' }
  }

  const params: Record<string, string> = {
    artist,
    track,
    timestamp: String(payload.listenedAt),
    sk,
  }
  if (payload.albumName?.trim()) {
    params.album = payload.albumName.trim()
  }

  const result = await lastFmCall(credentials, 'track.scrobble', params, 'POST')
  if (!result.ok) return result
  return { ok: true }
}
