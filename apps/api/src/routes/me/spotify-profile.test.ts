// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

vi.mock('../../lib/spotify-session.js', () => ({
  spotifyConfigured: vi.fn().mockReturnValue(true),
  getSpotifyAppToken: vi.fn().mockResolvedValue('fake-app-token'),
}))

vi.mock('@tahti/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tahti/shared')>()
  return {
    ...actual,
    getSpotifyArtist: vi.fn(async (_token: string, artistId: string) => {
      if (artistId === 'unknownartistid0000000') {
        throw new Error('not found')
      }
      return { id: artistId, name: 'Test Artist', imageUrl: 'https://i.scdn.co/image/abc' }
    }),
  }
})

const PREFIX = 'spotify-profile-test-'

describe('spotify profile link/unlink', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let userId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'spotify-profile-artist',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98381,
    })
    userId = artist.id
    cookie = await sessionCookieFor(prisma, artist.id)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('reports no profile linked initially', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/spotify-profile',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ configured: true, profile: null })
  })

  it('rejects a URL that does not parse to an artist ID', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/me/spotify-profile',
      headers: { cookie },
      payload: { artistUrl: 'https://example.com/not-spotify' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('rejects an artist ID that does not resolve on Spotify', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/me/spotify-profile',
      headers: { cookie },
      payload: { artistUrl: 'spotify:artist:unknownartistid0000000' },
    })
    expect(res.statusCode).toBe(404)
  })

  it('links a verified artist profile and persists it', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/me/spotify-profile',
      headers: { cookie },
      payload: { artistUrl: 'https://open.spotify.com/artist/06HL4z0CvFAxyc27GXpf02' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({
      configured: true,
      profile: {
        artistId: '06HL4z0CvFAxyc27GXpf02',
        name: 'Test Artist',
        imageUrl: 'https://i.scdn.co/image/abc',
      },
    })

    const row = await prisma.user.findUnique({
      where: { id: userId },
      select: { spotifyArtistId: true },
    })
    expect(row?.spotifyArtistId).toBe('06HL4z0CvFAxyc27GXpf02')

    const status = await app.inject({
      method: 'GET',
      url: '/api/me/spotify-profile',
      headers: { cookie },
    })
    expect(status.json().profile.artistId).toBe('06HL4z0CvFAxyc27GXpf02')
  })

  it('unlinks the profile', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/me/spotify-profile',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(204)

    const row = await prisma.user.findUnique({
      where: { id: userId },
      select: { spotifyArtistId: true },
    })
    expect(row?.spotifyArtistId).toBeNull()
  })

  it('requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/me/spotify-profile' })
    expect(res.statusCode).toBe(401)
  })
})
