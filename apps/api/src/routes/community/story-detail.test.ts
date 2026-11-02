// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@tahti/db'
import { CommunityStoryDetailSchema } from '@tahti/shared'
import { buildApp } from '../../server.js'
import { cleanupUsersByEmailPrefix, createTestArtist } from '../../test/helpers.js'

const PREFIX = 'story-detail-'

describe('GET /api/v1/community/stories/:id', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const writer = await createTestArtist(prisma, {
      email: `${PREFIX}writer@example.com`,
      username: `${PREFIX}writer`,
      displayName: 'Story Writer',
    })
    const suspended = await createTestArtist(prisma, {
      email: `${PREFIX}suspended@example.com`,
      username: `${PREFIX}suspended`,
    })
    await prisma.user.update({ where: { id: suspended.id }, data: { suspendedAt: new Date() } })
    await prisma.artistPost.createMany({
      data: [
        {
          id: `${PREFIX}full`,
          userId: writer.id,
          title: 'The whole story',
          body: 'First paragraph.\n\nSecond paragraph with **bold** text.',
          images: ['https://media.example/a.jpg', 'https://media.example/b.jpg'],
          linkUrl: 'https://example.com/more',
          linkLabel: 'Read more',
          category: 'NEWS',
          publishAt: new Date(Date.now() - 60_000),
        },
        {
          id: `${PREFIX}later`,
          userId: writer.id,
          body: 'Not out yet',
          publishAt: new Date(Date.now() + 3_600_000),
        },
        {
          id: `${PREFIX}hidden`,
          userId: suspended.id,
          body: 'Suspended author',
          publishAt: new Date(Date.now() - 60_000),
        },
      ],
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('returns the full post', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/community/stories/${PREFIX}full` })
    expect(res.statusCode).toBe(200)
    const story = CommunityStoryDetailSchema.parse(res.json())
    expect(story).toMatchObject({
      title: 'The whole story',
      category: 'NEWS',
      body: 'First paragraph.\n\nSecond paragraph with **bold** text.',
      images: ['https://media.example/a.jpg', 'https://media.example/b.jpg'],
      imageUrl: 'https://media.example/a.jpg',
      linkUrl: 'https://example.com/more',
      linkLabel: 'Read more',
      author: { displayName: 'Story Writer' },
    })
  })

  it('hides scheduled posts and unavailable authors', async () => {
    for (const id of [`${PREFIX}later`, `${PREFIX}hidden`, `${PREFIX}missing`]) {
      const res = await app.inject({ method: 'GET', url: `/api/v1/community/stories/${id}` })
      expect(res.statusCode).toBe(404)
    }
  })
})
