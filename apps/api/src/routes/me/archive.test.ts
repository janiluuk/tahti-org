// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createReadyArchiveItem,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'archive-meta-test-'

describe('M22/M24/M25 — archive metadata and slideshow', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let artistUserId: string
  let archiveItemId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'archive-meta-artist',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98510,
    })
    artistUserId = artist.id
    cookie = await sessionCookieFor(prisma, artist.id)
    const item = await createReadyArchiveItem(prisma, artist.channel!.id, 'Original title')
    archiveItemId = item.id
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('updates archive metadata and visibility flags', async () => {
    const patch = await app.inject({
      method: 'PATCH',
      url: `/api/me/archive/${archiveItemId}`,
      headers: { cookie },
      payload: {
        title: 'Renamed set',
        description: 'Recorded live in Helsinki',
        tracklist: [{ startSec: 0, title: 'Intro' }],
        bannerUrl: 'https://cdn.example/banner.jpg',
        commentary: 'Thanks for listening',
        genre: 'Techno',
        recordingLocation: 'Helsinki, Finland',
        subGenres: ['peak-time', 'melodic'],
        contentType: 'DJ_MIX',
        mixVersion: 'Original Mix',
        bpm: 128,
        musicalKey: 'Am',
        license: 'CC_BY_NC',
        isAiGenerated: false,
        isPublic: false,
        isFallback: true,
      },
    })
    expect(patch.statusCode).toBe(200)
    expect(patch.json().title).toBe('Renamed set')
    expect(patch.json().genre).toBe('Techno')
    expect(patch.json().contentType).toBe('DJ_MIX')
    expect(patch.json().license).toBe('CC_BY_NC')
    expect(patch.json().isPublic).toBe(false)
    expect(patch.json().isFallback).toBe(true)
    expect(patch.json().tracklist).toEqual([{ startSec: 0, title: 'Intro' }])
  })

  it('lists archive items with metadata on GET /api/me/archive', async () => {
    const list = await app.inject({
      method: 'GET',
      url: '/api/me/archive',
      headers: { cookie },
    })
    expect(list.statusCode).toBe(200)
    const row = list.json().find((i: { id: string }) => i.id === archiveItemId)
    expect(row).toBeTruthy()
    expect(row.license).toBe('CC_BY_NC')
    expect(row.contentType).toBe('DJ_MIX')
    expect(row.genre).toBe('Techno')
  })

  it('rejects empty title updates', async () => {
    const patch = await app.inject({
      method: 'PATCH',
      url: `/api/me/archive/${archiveItemId}`,
      headers: { cookie },
      payload: { title: '   ' },
    })
    expect(patch.statusCode).toBe(400)
  })

  it('updates channel slideshow images', async () => {
    const patch = await app.inject({
      method: 'PATCH',
      url: '/api/me/channel/slideshow',
      headers: { cookie },
      payload: {
        slideshowImages: ['https://cdn.example/1.jpg', 'https://cdn.example/2.jpg'],
      },
    })
    expect(patch.statusCode).toBe(200)
    expect(patch.json().slideshowImages).toHaveLength(2)

    const channel = await prisma.channel.findFirst({
      where: { user: { email: { startsWith: PREFIX } } },
      select: { slideshowImages: true },
    })
    expect(channel?.slideshowImages).toHaveLength(2)
  })

  it('sets twisted wave gallery mode via PATCH /api/me/channel/gallery', async () => {
    const patch = await app.inject({
      method: 'PATCH',
      url: '/api/me/channel/gallery',
      headers: { cookie },
      payload: {
        galleryMode: 'TWISTED_WAVE_GLSL',
        slideshowImages: ['https://cdn.example/wave1.jpg', 'https://cdn.example/wave2.jpg'],
      },
    })
    expect(patch.statusCode).toBe(200)
    expect(patch.json().galleryMode).toBe('TWISTED_WAVE_GLSL')

    const publicChannel = await app.inject({
      method: 'GET',
      url: '/api/channels/archive-meta-artist',
    })
    expect(publicChannel.statusCode).toBe(200)
    expect(publicChannel.json().galleryMode).toBe('TWISTED_WAVE_GLSL')
    expect(publicChannel.json().slideshowImages).toHaveLength(2)
  })

  it('tags a Tahti artist in tracklist and records TRACKLIST mention', async () => {
    const tagged = await createTestArtist(prisma, {
      email: `${PREFIX}tagged@example.com`,
      username: 'archive-meta-tagged',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98511,
    })

    const patch = await app.inject({
      method: 'PATCH',
      url: `/api/me/archive/${archiveItemId}`,
      headers: { cookie },
      payload: {
        tracklist: [
          { startSec: 0, title: 'Opener', artistUsername: 'archive-meta-tagged' },
          { startSec: 120, title: 'Main', artist: 'Guest DJ' },
        ],
      },
    })
    expect(patch.statusCode).toBe(200)
    expect(patch.json().tracklist[0].artistUsername).toBe('archive-meta-tagged')

    const mention = await prisma.mention.findFirst({
      where: {
        mentionerUserId: artistUserId,
        targetUserId: tagged.id,
        surface: 'TRACKLIST',
      },
    })
    expect(mention).toBeTruthy()
  })

  it('sets cosmic neon text layer via PATCH /api/me/channel/text-layer', async () => {
    const patch = await app.inject({
      method: 'PATCH',
      url: '/api/me/channel/text-layer',
      headers: { cookie },
      payload: {
        textLayerMode: 'COSMIC_NEON',
        textLayerText: 'Live on Tahti',
        textLayerAlign: 'LEFT',
      },
    })
    expect(patch.statusCode).toBe(200)
    expect(patch.json().textLayerMode).toBe('COSMIC_NEON')
    expect(patch.json().textLayerText).toBe('Live on Tahti')

    const publicChannel = await app.inject({
      method: 'GET',
      url: '/api/channels/archive-meta-artist',
    })
    expect(publicChannel.statusCode).toBe(200)
    expect(publicChannel.json().textLayerMode).toBe('COSMIC_NEON')
    expect(publicChannel.json().textLayerText).toBe('Live on Tahti')
    expect(publicChannel.json().textLayerAlign).toBe('LEFT')
  })
})
