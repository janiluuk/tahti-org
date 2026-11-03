// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@tahti/db'
import type { CommunityStory } from '@tahti/shared'
import { buildApp } from '../../server.js'
import {
  cleanupUsersByEmailPrefix,
  createReadySound,
  createTestArtist,
} from '../../test/helpers.js'

const PREFIX = 'stories-cover-'

describe('GET /api/v1/community/stories cover image', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  async function storyById(id: string): Promise<CommunityStory | undefined> {
    for (let cursor: string | null = null, page = 0; page < 100; page++) {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/community/stories?limit=30${cursor ? `&cursor=${cursor}` : ''}`,
      })
      expect(res.statusCode).toBe(200)
      const body = res.json() as { items: CommunityStory[]; nextCursor: string | null }
      const hit = body.items.find((item) => item.id === id)
      if (hit) return hit
      if (!body.nextCursor) return undefined
      cursor = body.nextCursor
    }
    return undefined
  }

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const withTracks = await createTestArtist(prisma, {
      email: `${PREFIX}tracks@example.com`,
      username: 'stories-cover-tracks',
    })
    const channelId = withTracks.channel!.id
    const older = await createReadySound(prisma, channelId, 'Older')
    const newer = await createReadySound(prisma, channelId, 'Newer')
    const privateTrack = await createReadySound(prisma, channelId, 'Private')
    await prisma.sound.update({
      where: { id: older.id },
      data: {
        isPublic: true,
        bannerUrl: 'https://media.example/older.jpg',
        releasedAt: new Date(Date.now() - 86_400_000),
      },
    })
    await prisma.sound.update({
      where: { id: newer.id },
      data: {
        isPublic: true,
        bannerUrl: 'https://media.example/newer.jpg',
        releasedAt: new Date(),
      },
    })
    await prisma.sound.update({
      where: { id: privateTrack.id },
      data: {
        isPublic: false,
        bannerUrl: 'https://media.example/private.jpg',
        releasedAt: new Date(Date.now() + 1000),
      },
    })

    const noTracks = await createTestArtist(prisma, {
      email: `${PREFIX}none@example.com`,
      username: 'stories-cover-none',
    })

    await prisma.artistPost.createMany({
      data: [
        {
          id: `${PREFIX}own-image`,
          userId: withTracks.id,
          body: 'Has its own image',
          images: ['https://media.example/post.jpg'],
        },
        { id: `${PREFIX}track-cover`, userId: withTracks.id, body: 'No image of its own' },
        { id: `${PREFIX}nothing`, userId: noTracks.id, body: 'No image, no tracks' },
      ],
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it("keeps the post's own image", async () => {
    expect((await storyById(`${PREFIX}own-image`))?.imageUrl).toBe('https://media.example/post.jpg')
  })

  it('falls back to the newest public track cover', async () => {
    expect((await storyById(`${PREFIX}track-cover`))?.imageUrl).toBe(
      'https://media.example/newer.jpg',
    )
  })

  it('stays null when the artist has no public track cover', async () => {
    expect((await storyById(`${PREFIX}nothing`))?.imageUrl).toBeNull()
  })
})
