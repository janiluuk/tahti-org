// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { createTestArtist } from '../../test/helpers.js'

const PREFIX = 'public-news-'

describe('GET /api/v1/news', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })

    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: `${PREFIX}board`,
      tier: 'ARTIST',
      isBoard: true,
    })

    await prisma.newsPost.createMany({
      data: [
        {
          headline: 'Published post',
          summary: 'Visible to everyone',
          authorId: board.id,
          authorName: board.displayName,
          publishedAt: new Date('2026-01-01T00:00:00Z'),
        },
        {
          headline: 'Draft post',
          summary: 'Not visible yet',
          authorId: board.id,
          authorName: board.displayName,
          publishedAt: null,
        },
      ],
    })
  })

  afterAll(async () => {
    await prisma.newsPost.deleteMany({
      where: { headline: { in: ['Published post', 'Draft post'] } },
    })
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })
    await app.close()
  })

  it('returns only published posts, with a byline, no auth required', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/news' })
    expect(res.statusCode).toBe(200)
    const posts = res.json() as Array<{ headline: string; authorName: string }>
    expect(posts.map((p) => p.headline)).toContain('Published post')
    expect(posts.map((p) => p.headline)).not.toContain('Draft post')
    expect(posts.find((p) => p.headline === 'Published post')?.authorName).toBeTruthy()
  })
})
