// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@tahti/db'
import { buildApp } from '../../server.js'
import { encryptStreamKey } from '../../lib/stream-key-enc.js'
import {
  SOUNDCLOUD_TICKET_TTL_MS,
  createSoundcloudTicket,
  verifySoundcloudTicket,
} from '../../lib/soundcloud-download-ticket.js'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'soundcloud-sets-test-'
const TOKEN = 'sc-oauth-token'
const CDN = 'https://cf-media.sndcdn.com/abc.mp3?Policy=signed'

type Route = (url: URL, init: RequestInit | undefined) => Response | undefined

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const scTrack = (id: number, extra: Record<string, unknown> = {}) => ({
  id,
  title: `Track ${id}`,
  duration: 61_400,
  artwork_url: null,
  permalink_url: `https://soundcloud.com/dj/track-${id}`,
  downloadable: true,
  download_url: `https://api.soundcloud.com/tracks/${id}/download`,
  user: { username: 'DJ Test', permalink: 'dj-test' },
  ...extra,
})

describe('SoundCloud sets for the desktop import', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let userId: string
  let routes: Route[]
  let calls: Array<{ url: string; auth: string | null; redirect: RequestRedirect | undefined }>
  const realFetch = globalThis.fetch

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'soundcloud-sets-artist',
      tier: 'ARTIST',
    })
    userId = artist.id
    cookie = await sessionCookieFor(prisma, userId)
  })

  beforeEach(async () => {
    await prisma.user.update({
      where: { id: userId },
      data: { soundcloudAccessTokenEnc: encryptStreamKey(TOKEN) },
    })
    routes = []
    calls = []
    vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : input.toString())
      const headers = new Headers(init?.headers)
      calls.push({
        url: url.toString(),
        auth: headers.get('authorization'),
        redirect: init?.redirect,
      })
      for (const route of routes) {
        const res = route(url, init)
        if (res) return res
      }
      if (url.hostname.endsWith('soundcloud.com')) return json({ error: 'unmocked' }, 500)
      return realFetch(input, init)
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  const get = (url: string, withCookie = true) =>
    app.inject({ method: 'GET', url, headers: withCookie ? { cookie } : {} })

  it('lists playlists across pages with the OAuth token, and needs a connection', async () => {
    routes.push((url) => {
      if (url.pathname !== '/me/playlists') return undefined
      return url.searchParams.get('page') === '2'
        ? json({ collection: [{ id: 2, title: 'Second', track_count: 1 }], next_href: null })
        : json({
            collection: [
              {
                id: 1,
                title: ' Night Set ',
                track_count: 12,
                artwork_url: 'https://i1.sndcdn.com/a.jpg',
              },
            ],
            next_href: 'https://api.soundcloud.com/me/playlists?page=2',
          })
    })

    const res = await get('/api/me/soundcloud/playlists')

    expect(res.statusCode).toBe(200)
    expect(res.json().playlists).toEqual([
      {
        id: '1',
        title: 'Night Set',
        trackCount: 12,
        artworkUrl: 'https://i1.sndcdn.com/a.jpg',
        permalinkUrl: null,
      },
      { id: '2', title: 'Second', trackCount: 1, artworkUrl: null, permalinkUrl: null },
    ])
    expect(calls.every((call) => call.auth === `OAuth ${TOKEN}`)).toBe(true)

    await prisma.user.update({ where: { id: userId }, data: { soundcloudAccessTokenEnc: null } })
    expect((await get('/api/me/soundcloud/playlists')).statusCode).toBe(403)
    expect((await get('/api/me/soundcloud/playlists', false)).statusCode).toBe(401)
  })

  it('never follows a next_href off SoundCloud with the token', async () => {
    routes.push((url) =>
      url.pathname === '/me/playlists'
        ? json({ collection: [], next_href: 'https://evil.example/steal' })
        : undefined,
    )
    const res = await get('/api/me/soundcloud/playlists')
    expect(res.statusCode).toBe(502)
    expect(calls.some((call) => call.url.includes('evil.example'))).toBe(false)
  })

  it('returns playlist tracks in order with download links only for downloadable ones', async () => {
    routes.push((url) =>
      url.pathname === '/playlists/77/tracks'
        ? json({
            collection: [
              scTrack(3),
              scTrack(1, { downloadable: false, download_url: null }),
              scTrack(2, { user: { username: 'dj@example.com', permalink: 'dj-perma' } }),
            ],
          })
        : undefined,
    )

    const res = await get('/api/me/soundcloud/playlists/77/tracks')

    expect(res.statusCode).toBe(200)
    const tracks = res.json().tracks
    expect(tracks.map((t: { id: string }) => t.id)).toEqual(['3', '1', '2'])
    expect(tracks[0]).toMatchObject({ title: 'Track 3', username: 'DJ Test', durationSec: 61 })
    expect(tracks[0].download.url).toMatch(
      /\/api\/v1\/imports\/soundcloud\/tracks\/3\/download\?ticket=[\w-]+\.[\w-]+$/,
    )
    expect(Date.parse(tracks[0].download.expiresAt)).toBeGreaterThan(Date.now())
    expect(tracks[1].download).toBeNull()
    expect(tracks[2].username).toBe('dj-perma')
    expect(JSON.stringify(tracks)).not.toContain(TOKEN)
    expect(new URL(calls[0]!.url).searchParams.get('access')).toBe('playable,preview,blocked')
  })

  it('rejects odd playlist ids and clears an expired token', async () => {
    expect((await get('/api/me/soundcloud/playlists/..%2Fme/tracks')).statusCode).toBe(400)

    routes.push((url) => (url.pathname === '/playlists/5/tracks' ? json({}, 401) : undefined))
    const res = await get('/api/me/soundcloud/playlists/5/tracks')
    expect(res.statusCode).toBe(401)
    const row = await prisma.user.findUnique({
      where: { id: userId },
      select: { soundcloudAccessTokenEnc: true },
    })
    expect(row?.soundcloudAccessTokenEnc).toBeNull()
  })

  it('resolves a pasted set link and refuses other links', async () => {
    routes.push((url) => {
      if (url.pathname !== '/resolve') return undefined
      return url.searchParams.get('url')?.includes('/sets/')
        ? json({ kind: 'playlist', id: 9, title: 'Summer', track_count: 4 })
        : json({ kind: 'track', id: 4 })
    })

    const ok = await get(
      `/api/me/soundcloud/resolve?url=${encodeURIComponent('https://soundcloud.com/dj/sets/summer')}`,
    )
    expect(ok.statusCode).toBe(200)
    expect(ok.json().playlist).toMatchObject({ id: '9', title: 'Summer', trackCount: 4 })

    const track = await get(
      `/api/me/soundcloud/resolve?url=${encodeURIComponent('https://soundcloud.com/dj/a-track')}`,
    )
    expect(track.statusCode).toBe(422)

    const elsewhere = await get(
      `/api/me/soundcloud/resolve?url=${encodeURIComponent('https://example.com/dj/sets/x')}`,
    )
    expect(elsewhere.statusCode).toBe(400)
  })

  describe('download links', () => {
    const link = (trackId: string, ticket: string) =>
      `/api/v1/imports/soundcloud/tracks/${trackId}/download?ticket=${ticket}`

    const downloadRoutes = (download: Record<string, unknown> = {}) => {
      routes.push((url, init) => {
        if (url.pathname === '/tracks/3') return json(scTrack(3, download))
        if (url.pathname === '/tracks/3/download') {
          expect(init?.redirect).toBe('manual')
          return new Response(null, { status: 302, headers: { location: CDN } })
        }
        return undefined
      })
    }

    it('redirects to the SoundCloud file without a session, for GET and HEAD', async () => {
      downloadRoutes()
      const { ticket } = createSoundcloudTicket(userId, '3')

      const res = await get(link('3', ticket), false)
      expect(res.statusCode).toBe(302)
      expect(res.headers.location).toBe(CDN)
      expect(res.headers['cache-control']).toBe('no-store')

      const head = await app.inject({ method: 'HEAD', url: link('3', ticket) })
      expect(head.statusCode).toBe(302)
      expect(head.headers.location).toBe(CDN)
      expect(
        calls
          .filter((call) => call.url.endsWith('/download'))
          .every((c) => c.auth === `OAuth ${TOKEN}`),
      ).toBe(true)
    })

    it('refuses tampered, expired and no-longer-downloadable links', async () => {
      const { ticket } = createSoundcloudTicket(userId, '3')
      const [body] = ticket.split('.')
      const forged = `${Buffer.from(JSON.stringify({ u: userId, t: '4', e: Date.now() + 60_000 })).toString('base64url')}.${ticket.split('.')[1]}`
      expect((await get(link('4', forged), false)).statusCode).toBe(404)
      expect((await get(link('3', `${body}.x`), false)).statusCode).toBe(404)
      expect((await get(link('4', ticket), false)).statusCode).toBe(404)

      const old = createSoundcloudTicket(
        userId,
        '3',
        Date.now() - SOUNDCLOUD_TICKET_TTL_MS - 1,
      ).ticket
      expect((await get(link('3', old), false)).statusCode).toBe(410)

      downloadRoutes({ downloadable: false })
      expect((await get(link('3', ticket), false)).statusCode).toBe(403)
      expect(calls.some((call) => call.url.endsWith('/download'))).toBe(false)
    })

    it('does not send the token to a download_url off SoundCloud', async () => {
      downloadRoutes({ download_url: 'https://evil.example/file' })
      const { ticket } = createSoundcloudTicket(userId, '3')
      expect((await get(link('3', ticket), false)).statusCode).toBe(502)
      expect(calls.some((call) => call.url.includes('evil.example'))).toBe(false)
    })

    it('stops working once SoundCloud is disconnected', async () => {
      downloadRoutes()
      const { ticket } = createSoundcloudTicket(userId, '3')
      await prisma.user.update({ where: { id: userId }, data: { soundcloudAccessTokenEnc: null } })
      expect((await get(link('3', ticket), false)).statusCode).toBe(403)
    })
  })
})

describe('SoundCloud download tickets', () => {
  it('round-trips and expires', () => {
    const now = 1_700_000_000_000
    const { ticket, expiresAt } = createSoundcloudTicket('user-1', '42', now)
    expect(verifySoundcloudTicket(ticket, now + 1000)).toEqual({
      ok: true,
      userId: 'user-1',
      trackId: '42',
    })
    expect(expiresAt.getTime()).toBe(now + SOUNDCLOUD_TICKET_TTL_MS)
    expect(verifySoundcloudTicket(ticket, now + SOUNDCLOUD_TICKET_TTL_MS)).toEqual({
      ok: false,
      reason: 'expired',
    })
    expect(verifySoundcloudTicket('garbage', now)).toEqual({ ok: false, reason: 'invalid' })
    expect(verifySoundcloudTicket(`${ticket}.more`, now)).toEqual({ ok: false, reason: 'invalid' })
  })
})
