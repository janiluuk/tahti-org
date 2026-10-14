// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import {
  ImportOAuthConnectStatusSchema,
  MixcloudConnectStatusSchema,
  SoundcloudTrackListSchema,
} from '@tahti/shared'
import { prisma } from '@tahti/db'
import { buildApp } from '../../server.js'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'
import { config } from '../../config.js'
import { encryptStreamKey } from '../../lib/stream-key-enc.js'

const PREFIX = 'import-oauth-connect-'

const PROVIDERS = [
  { key: 'bandcamp', base: '/api/me/bandcamp', authorizeHost: 'bandcamp.com', flag: 'bc' },
  { key: 'soundcloud', base: '/api/me/soundcloud', authorizeHost: 'soundcloud.com', flag: 'sc' },
] as const

describe('OAuth import providers: status, connect and disconnect', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let userId: string
  const original = {
    bandcamp: { ...config.bandcamp },
    soundcloud: { ...config.soundcloud },
    mixcloud: { ...config.mixcloud },
  }

  function setCredentials(key: keyof typeof original, clientId: string, clientSecret: string) {
    config[key].clientId = clientId
    config[key].clientSecret = clientSecret
  }

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const user = await createTestArtist(prisma, {
      email: `${PREFIX}user@example.com`,
      username: 'import-oauth-connect-user',
    })
    userId = user.id
    cookie = await sessionCookieFor(prisma, user.id)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    for (const key of ['bandcamp', 'soundcloud', 'mixcloud'] as const) {
      setCredentials(key, original[key].clientId, original[key].clientSecret)
    }
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  describe.each(PROVIDERS)('$key', ({ key, base, authorizeHost, flag }) => {
    it('status requires a signed-in account', async () => {
      const res = await app.inject({ method: 'GET', url: base })
      expect(res.statusCode).toBe(401)
    })

    it('reports configured only when the server has both the client id and the secret', async () => {
      setCredentials(key, 'client-id', 'client-secret')
      const both = await app.inject({ method: 'GET', url: base, headers: { cookie } })
      expect(both.statusCode).toBe(200)
      expect(ImportOAuthConnectStatusSchema.parse(both.json())).toEqual({
        connected: false,
        configured: true,
      })

      setCredentials(key, 'client-id', '')
      const idOnly = await app.inject({ method: 'GET', url: base, headers: { cookie } })
      expect(idOnly.json()).toEqual({ connected: false, configured: false })
    })

    it('connect redirects to the provider with a state cookie', async () => {
      setCredentials(key, 'client-id', 'client-secret')
      const res = await app.inject({
        method: 'GET',
        url: `${base}/oauth/start`,
        headers: { cookie },
      })
      expect(res.statusCode).toBe(302)
      const target = new URL(res.headers.location as string)
      expect(target.hostname).toBe(authorizeHost)
      expect(target.searchParams.get('client_id')).toBe('client-id')
      const state = target.searchParams.get('state')
      expect(state).toBeTruthy()
      expect(String(res.headers['set-cookie'])).toContain(
        `${config[key].oauthStateCookie}=${state}`,
      )
    })

    it('connect answers 503 instead of redirecting when the secret is missing', async () => {
      setCredentials(key, 'client-id', '')
      const res = await app.inject({
        method: 'GET',
        url: `${base}/oauth/start`,
        headers: { cookie },
      })
      expect(res.statusCode).toBe(503)
    })

    it('the callback sends a mismatched state back to the import page as an error', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `${base}/oauth/callback?code=abc&state=not-the-cookie`,
        headers: { cookie },
      })
      expect(res.statusCode).toBe(302)
      expect(res.headers.location).toBe(
        `${config.appUrl}/dashboard/upload/import/${key}?${flag}=error`,
      )
    })

    it('disconnect reports the same configured value as status', async () => {
      setCredentials(key, 'client-id', '')
      const res = await app.inject({ method: 'DELETE', url: base, headers: { cookie } })
      expect(res.statusCode).toBe(200)
      expect(ImportOAuthConnectStatusSchema.parse(res.json())).toEqual({
        connected: false,
        configured: false,
      })
    })
  })

  it('SoundCloud track list is refused until the account is connected', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/soundcloud/tracks',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().code).toBe('PROVIDER_NOT_CONNECTED')
  })

  describe('SoundCloud track list for a connected account', () => {
    const connect = () =>
      prisma.user.update({
        where: { id: userId },
        data: { soundcloudAccessTokenEnc: encryptStreamKey('sc-token') },
      })

    it('lists only the tracks SoundCloud lets us download', async () => {
      await connect()
      vi.stubGlobal(
        'fetch',
        vi.fn(async () =>
          Response.json({
            collection: [
              {
                id: 101,
                title: 'Downloadable mix',
                duration: 185000,
                downloadable: true,
                download_url: 'https://api.soundcloud.com/tracks/101/download',
                artwork_url: 'https://i1.sndcdn.com/artworks-101.jpg',
                created_at: '2026/01/02 03:04:05 +0000',
              },
              {
                id: 102,
                title: 'Stream only',
                duration: 90000,
                downloadable: false,
                created_at: '2026/01/03 03:04:05 +0000',
              },
            ],
          }),
        ),
      )

      const res = await app.inject({
        method: 'GET',
        url: '/api/me/soundcloud/tracks',
        headers: { cookie },
      })
      expect(res.statusCode).toBe(200)
      expect(SoundcloudTrackListSchema.parse(res.json())).toEqual({
        tracks: [
          {
            id: '101',
            title: 'Downloadable mix',
            durationMs: 185000,
            artworkUrl: 'https://i1.sndcdn.com/artworks-101.jpg',
            downloadable: true,
            createdAt: '2026/01/02 03:04:05 +0000',
          },
        ],
      })
    })

    it('an expired token answers 401 and clears the connection', async () => {
      await connect()
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response('', { status: 401 })),
      )

      const res = await app.inject({
        method: 'GET',
        url: '/api/me/soundcloud/tracks',
        headers: { cookie },
      })
      expect(res.statusCode).toBe(401)
      expect(res.json().code).toBe('PROVIDER_TOKEN_EXPIRED')
      const row = await prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { soundcloudAccessTokenEnc: true },
      })
      expect(row.soundcloudAccessTokenEnc).toBeNull()
    })
  })

  it('Mixcloud status, connect and disconnect agree when only the client id is set', async () => {
    setCredentials('mixcloud', 'client-id', '')
    const status = await app.inject({ method: 'GET', url: '/api/me/mixcloud', headers: { cookie } })
    const start = await app.inject({
      method: 'GET',
      url: '/api/me/mixcloud/oauth/start',
      headers: { cookie },
    })
    const disconnect = await app.inject({
      method: 'DELETE',
      url: '/api/me/mixcloud',
      headers: { cookie },
    })
    expect(MixcloudConnectStatusSchema.parse(status.json()).configured).toBe(false)
    expect(start.statusCode).toBe(503)
    expect(MixcloudConnectStatusSchema.parse(disconnect.json()).configured).toBe(false)
  })
})
