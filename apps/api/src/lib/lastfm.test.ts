// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getLastFmAuthToken,
  getLastFmSession,
  lastFmAuthUrl,
  signLastFmParams,
  submitLastFmScrobble,
} from './lastfm.js'

const credentials = { apiKey: 'key', apiSecret: 'secret' }

describe('lastfm', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('signs params with sorted keys + secret', () => {
    // Documented Last.fm example shape: md5 of concatenated sorted pairs + secret
    const sig = signLastFmParams({ api_key: 'key', method: 'auth.getToken' }, 'secret')
    expect(sig).toMatch(/^[a-f0-9]{32}$/)
    expect(sig).toBe(signLastFmParams({ method: 'auth.getToken', api_key: 'key' }, 'secret'))
  })

  it('builds the auth URL with optional callback', () => {
    expect(lastFmAuthUrl('key', 'tok')).toBe('https://www.last.fm/api/auth?api_key=key&token=tok')
    expect(lastFmAuthUrl('key', 'tok', 'https://api.example/cb')).toContain(
      'cb=https%3A%2F%2Fapi.example%2Fcb',
    )
  })

  it('getLastFmAuthToken returns the token', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ token: 'temp-token' }), { status: 200 }),
    )
    const result = await getLastFmAuthToken(credentials)
    expect(result).toEqual({ ok: true, token: 'temp-token' })
  })

  it('getLastFmSession returns session key and username', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ session: { name: 'alice', key: 'sk-1' } }), {
        status: 200,
      }),
    )
    const result = await getLastFmSession(credentials, 'temp-token')
    expect(result).toEqual({ ok: true, sessionKey: 'sk-1', username: 'alice' })
  })

  it('submitLastFmScrobble posts track.scrobble', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ scrobbles: {} }), { status: 200 }),
    )
    const result = await submitLastFmScrobble(credentials, 'sk-1', {
      artistName: 'Artist',
      trackName: 'Track',
      listenedAt: 1_700_000_000,
    })
    expect(result).toEqual({ ok: true })
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      'https://ws.audioscrobbler.com/2.0/',
      expect.objectContaining({ method: 'POST' }),
    )
    const init = vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit
    const body = String(init.body)
    expect(body).toContain('method=track.scrobble')
    expect(body).toContain('sk=sk-1')
    expect(body).not.toContain('secret')
  })

  it('surfaces Last.fm error messages without leaking the session key', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: 9, message: 'Invalid session key' }), {
        status: 200,
      }),
    )
    const result = await submitLastFmScrobble(credentials, 'sk-secret', {
      artistName: 'A',
      trackName: 'T',
      listenedAt: 1,
    })
    expect(result).toEqual({ ok: false, error: 'Invalid session key' })
    expect(JSON.stringify(result)).not.toContain('sk-secret')
  })
})
