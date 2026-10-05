// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

const SAMPLE_TRACK = {
  id: '14624101',
  title: 'Credo',
  permalink: 'credo',
  permalink_url: 'https://hearthis.at/candana-dj/credo/',
  uri: 'https://api-v2.hearthis.at/candana-dj/credo/',
  duration: '4015',
  genre: 'Techno',
  downloadable: '1',
  download_url: 'https://hearthis.at/candana-dj/credo/download/',
  download_filename: 'Credo.mp3',
  created_at: '2026-08-12 12:18:43',
  release_date: '2026-08-12 12:18:43',
  artwork_url: 'https://img.hearthis.at/artwork.jpg',
  user: {
    id: '10464002',
    permalink: 'candana-dj',
    username: 'Carlos Andana',
    uri: 'https://api-v2.hearthis.at/candana-dj/',
    permalink_url: 'https://hearthis.at/candana-dj/',
  },
  stream_url: 'https://hearthis.app/candana-dj/credo/listen/?s=XPS',
}

const { mockSearch, mockGetUserTracks, mockGetUserPlaylists, mockGetSetTracks, mockGetTrackByUrl } =
  vi.hoisted(() => ({
    mockSearch: vi.fn(),
    mockGetUserTracks: vi.fn(),
    mockGetUserPlaylists: vi.fn(),
    mockGetSetTracks: vi.fn(),
    mockGetTrackByUrl: vi.fn(),
  }))

vi.mock('@tahti/hearthis', () => ({
  createHearthisClient: () => ({
    search: mockSearch,
    getUserTracks: mockGetUserTracks,
    getUserPlaylists: mockGetUserPlaylists,
    getSetTracks: mockGetSetTracks,
    getTrackByUrl: mockGetTrackByUrl,
  }),
  parseHearthisUsername: (input: string) => {
    try {
      const url = new URL(input)
      if (!/(^|\.)hearthis\.at$/.test(url.hostname)) return null
      const match = /^\/([^/]+)\/?$/.exec(url.pathname)
      return match ? match[1] : null
    } catch {
      return /^[A-Za-z0-9_-]+$/.test(input) ? input : null
    }
  },
  parseHearthisSetPermalink: (input: string) => {
    const value = input.trim()
    if (!value) return null
    try {
      const url = new URL(value.startsWith('http') ? value : `https://hearthis.at/set/${value}/`)
      if (!/(^|\.)hearthis\.at$/.test(url.hostname)) return null
      const match = /^\/set\/([^/]+)\/?$/.exec(url.pathname)
      if (match) {
        const permalink = decodeURIComponent(match[1])
        return /^[\w-]+$/.test(permalink) ? permalink : null
      }
    } catch {
      // bare permalink
    }
    return /^[\w-]+$/.test(value) ? value : null
  },
}))

import { buildApp } from '../../server.js'
import { prisma, encryptIntegrationFields } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'hearthis-import-test-'

describe('hearthis.at mixed-source import', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let userId: string
  let collectionId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'hearthis-import-artist',
      tier: 'ARTIST',
    })
    cookie = await sessionCookieFor(prisma, artist.id)
    userId = artist.id

    await prisma.integrationCredential.create({
      data: { userId, providerSlug: 'hearthis-import', fieldsEnc: encryptIntegrationFields({}) },
    })

    const collection = await prisma.collection.create({
      data: { userId, name: 'Test collection', slug: 'hearthis-import-test-collection' },
    })
    collectionId = collection.id
  })

  afterAll(async () => {
    await prisma.collectionItem.deleteMany({ where: { collectionId } })
    await prisma.collection.deleteMany({ where: { userId } })
    await prisma.sound.deleteMany({ where: { channel: { userId } } })
    await prisma.integrationCredential.deleteMany({ where: { userId } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('requires q on search', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/imports/hearthis/search',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(400)
  })

  it('searches and returns normalized track results', async () => {
    mockSearch.mockResolvedValueOnce([SAMPLE_TRACK])
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/imports/hearthis/search?q=techno',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.tracks).toHaveLength(1)
    expect(body.tracks[0]).toMatchObject({
      title: 'Credo',
      username: 'Carlos Andana',
      userPermalink: 'candana-dj',
      durationSec: 4015,
    })
  })

  it('returns 502 when the upstream search fails', async () => {
    mockSearch.mockRejectedValueOnce(new Error('boom'))
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/imports/hearthis/search?q=techno',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(502)
  })

  it('me-tracks is empty when no hearthisUsername is stored', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/imports/hearthis/me-tracks',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ username: null, tracks: [] })
  })

  it('me-tracks uses the stored handle once set', async () => {
    await prisma.user.update({ where: { id: userId }, data: { hearthisUsername: 'candana-dj' } })
    mockGetUserTracks.mockResolvedValueOnce([SAMPLE_TRACK])
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/imports/hearthis/me-tracks',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.username).toBe('candana-dj')
    expect(body.tracks).toHaveLength(1)
  })

  it('me-sets is empty when no hearthisUsername is stored', async () => {
    await prisma.user.update({ where: { id: userId }, data: { hearthisUsername: null } })
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/imports/hearthis/me-sets',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ username: null, sets: [] })
  })

  it('me-sets lists playlists for the stored handle', async () => {
    await prisma.user.update({ where: { id: userId }, data: { hearthisUsername: 'yaniho' } })
    mockGetUserPlaylists.mockResolvedValueOnce([
      {
        id: '378936',
        permalink: '378936-9675121',
        title: 'Recorded sets from gigs',
        description: 'Recordings',
        track_count: 176,
        artwork_url: null,
        user: SAMPLE_TRACK.user,
      },
    ])
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/imports/hearthis/me-sets',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.username).toBe('yaniho')
    expect(body.sets).toHaveLength(1)
    expect(body.sets[0]).toMatchObject({
      permalink: '378936-9675121',
      title: 'Recorded sets from gigs',
      trackCount: 176,
      url: 'https://hearthis.at/set/378936-9675121/',
    })
  })

  it('lists tracks inside a set with download flags and set metadata', async () => {
    mockGetSetTracks.mockResolvedValueOnce([SAMPLE_TRACK])
    mockGetUserPlaylists.mockResolvedValueOnce([
      {
        id: '378936',
        permalink: '378936-9675121',
        title: 'Recorded sets from gigs',
        description: 'Recordings',
        track_count: 176,
        artwork_url: null,
        user: SAMPLE_TRACK.user,
      },
    ])
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/imports/hearthis/sets/378936-9675121/tracks',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.permalink).toBe('378936-9675121')
    expect(body.set).toMatchObject({
      permalink: '378936-9675121',
      title: 'Recorded sets from gigs',
      trackCount: 176,
    })
    expect(body.tracks).toHaveLength(1)
    expect(body.tracks[0]).toMatchObject({
      position: 1,
      title: 'Credo',
      downloadable: true,
      downloadUrl: expect.any(String),
    })
  })

  it('rejects an invalid set permalink', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/imports/hearthis/sets/not%20a%20set/tracks',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(400)
  })

  it('by-username rejects an unparseable profileUrl', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/imports/hearthis/by-username?profileUrl=https://soundcloud.com/x',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(400)
  })

  it('adds a track to a collection as an embed-only sound item', async () => {
    mockGetTrackByUrl.mockResolvedValueOnce(SAMPLE_TRACK)
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/imports/hearthis/add',
      headers: { cookie },
      payload: { collectionId, trackUrl: 'https://hearthis.at/candana-dj/credo/' },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.track.title).toBe('Credo')

    const sound = await prisma.sound.findUnique({ where: { id: body.soundId } })
    expect(sound?.source).toBe('HEARTHIS_EMBED')
    expect(sound?.embedProvider).toBe('HEARTHIS')
    expect(sound?.qualityBadge).toBe('EMBED_ONLY')
  })

  it("starts an added track with the owner's comment and top-list settings", async () => {
    await prisma.user.update({
      where: { id: userId },
      data: { defaultTrackCommentsEnabled: false, topListsOptOut: true },
    })
    try {
      mockGetTrackByUrl.mockResolvedValueOnce(SAMPLE_TRACK)
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/imports/hearthis/add',
        headers: { cookie },
        payload: { collectionId, trackUrl: 'https://hearthis.at/candana-dj/credo/' },
      })
      expect(res.statusCode).toBe(201)
      const sound = await prisma.sound.findUnique({ where: { id: res.json().soundId } })
      expect(sound?.commentsEnabled).toBe(false)
      expect(sound?.topListsEligible).toBe(false)
    } finally {
      await prisma.user.update({
        where: { id: userId },
        data: { defaultTrackCommentsEnabled: true, topListsOptOut: false },
      })
    }
  })

  it('rejects add with an invalid trackUrl', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/imports/hearthis/add',
      headers: { cookie },
      payload: { collectionId, trackUrl: 'not-a-url' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 502 when the upstream track fetch fails on add', async () => {
    mockGetTrackByUrl.mockRejectedValueOnce(new Error('boom'))
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/imports/hearthis/add',
      headers: { cookie },
      payload: { collectionId, trackUrl: 'https://hearthis.at/candana-dj/credo/' },
    })
    expect(res.statusCode).toBe(502)
  })
})
