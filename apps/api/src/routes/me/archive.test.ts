// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

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
        isPublic: false,
        isFallback: true,
      },
    })
    expect(patch.statusCode).toBe(200)
    expect(patch.json().title).toBe('Renamed set')
    expect(patch.json().isPublic).toBe(false)
    expect(patch.json().isFallback).toBe(true)
    expect(patch.json().tracklist).toEqual([{ startSec: 0, title: 'Intro' }])
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
})
