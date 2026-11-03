// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@tahti/db'
import { CommunityStoriesResponseSchema, type CommunityStory } from '@tahti/shared'
import { buildApp } from '../../server.js'
import { cleanupUsersByEmailPrefix, createTestArtist } from '../../test/helpers.js'

const PREFIX = 'community-stories-'
const URL = '/api/v1/community/stories'

describe('GET /api/v1/community/stories', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let writerId: string
  let suspendedId: string
  let deletedId: string
  let emailNamedId: string
  const t0 = Date.now() - 60_000

  async function getPage(query = '') {
    const res = await app.inject({ method: 'GET', url: `${URL}${query}` })
    return { res, body: res.json() as { items: CommunityStory[]; nextCursor: string | null } }
  }

  async function collectStories(limit: number, maxPages = 200): Promise<CommunityStory[]> {
    const all: CommunityStory[] = []
    let cursor: string | null = null
    for (let page = 0; page < maxPages; page++) {
      const query: string = `?limit=${limit}${cursor ? `&cursor=${cursor}` : ''}`
      const { res, body } = await getPage(query)
      expect(res.statusCode).toBe(200)
      expect(body.items.length).toBeLessThanOrEqual(limit)
      all.push(...body.items)
      if (!body.nextCursor) break
      cursor = body.nextCursor
    }
    return all
  }

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const writer = await createTestArtist(prisma, {
      email: `${PREFIX}writer@example.com`,
      username: 'community-stories-writer',
      displayName: 'Story Writer',
    })
    writerId = writer.id
    await prisma.user.update({
      where: { id: writer.id },
      data: { avatarUrl: 'https://media.example/avatar.png' },
    })

    const suspended = await createTestArtist(prisma, {
      email: `${PREFIX}suspended@example.com`,
      username: 'community-stories-suspended',
    })
    suspendedId = suspended.id

    const deleted = await createTestArtist(prisma, {
      email: `${PREFIX}deleted@example.com`,
      username: 'community-stories-deleted',
    })
    deletedId = deleted.id

    const emailNamed = await createTestArtist(prisma, {
      email: `${PREFIX}emailname@example.com`,
      username: 'community-stories-emailname',
      displayName: 'leaky.person@example.com',
    })
    emailNamedId = emailNamed.id

    await prisma.artistPost.createMany({
      data: [
        {
          id: `${PREFIX}p1`,
          userId: writerId,
          title: 'Oldest',
          body: 'First story body',
          publishAt: new Date(t0),
        },
        {
          id: `${PREFIX}p2`,
          userId: writerId,
          title: 'With image',
          body: '**Bold** news with [a link](https://example.com)',
          images: ['https://media.example/one.jpg', 'https://media.example/two.jpg'],
          category: 'NEWS',
          publishAt: new Date(t0 + 1_000),
        },
        // Same publishAt as p2 so the id tie-break decides the order.
        {
          id: `${PREFIX}p3`,
          userId: writerId,
          body: 'Tie on publishAt',
          category: 'ANNOUNCEMENT',
          publishAt: new Date(t0 + 1_000),
        },
        {
          id: `${PREFIX}p4`,
          userId: writerId,
          body: 'word '.repeat(200),
          publishAt: new Date(t0 + 2_000),
        },
        {
          id: `${PREFIX}p5`,
          userId: writerId,
          body: 'Newest published',
          publishAt: new Date(t0 + 3_000),
        },
        {
          id: `${PREFIX}scheduled`,
          userId: writerId,
          body: 'Not out yet',
          publishAt: new Date(Date.now() + 24 * 3600_000),
        },
        {
          id: `${PREFIX}suspended-post`,
          userId: suspendedId,
          body: 'From a suspended artist',
          publishAt: new Date(t0),
        },
        {
          id: `${PREFIX}deleted-post`,
          userId: deletedId,
          body: 'From a deleted artist',
          publishAt: new Date(t0),
        },
        {
          id: `${PREFIX}email-post`,
          userId: emailNamedId,
          body: 'Author has an email display name',
          publishAt: new Date(t0),
        },
      ],
    })
    await prisma.user.update({ where: { id: suspendedId }, data: { suspendedAt: new Date() } })
    await prisma.user.update({ where: { id: deletedId }, data: { deletedAt: new Date() } })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('is public, matches the response contract and sets a short public cache', async () => {
    const { res, body } = await getPage()
    expect(res.statusCode).toBe(200)
    expect(res.headers['cache-control']).toBe('public, max-age=30')
    expect(CommunityStoriesResponseSchema.safeParse(body).success).toBe(true)
    expect(body.items.length).toBeLessThanOrEqual(12)
  })

  it('maps a post to a story card', async () => {
    const stories = await collectStories(30)
    const story = stories.find((s) => s.id === `${PREFIX}p2`)
    expect(story).toEqual({
      id: `${PREFIX}p2`,
      category: 'NEWS',
      title: 'With image',
      excerpt: 'Bold news with a link',
      imageUrl: 'https://media.example/one.jpg',
      publishAt: new Date(t0 + 1_000).toISOString(),
      url: '/u/community-stories-writer',
      author: {
        username: 'community-stories-writer',
        displayName: 'Story Writer',
        avatarUrl: 'https://media.example/avatar.png',
      },
    })
    const plain = stories.find((s) => s.id === `${PREFIX}p1`)
    expect(plain).toMatchObject({ category: 'STORY', imageUrl: null })
  })

  it('leaves out scheduled posts and posts by suspended or deleted artists', async () => {
    const ids = new Set((await collectStories(30)).map((s) => s.id))
    expect(ids.has(`${PREFIX}p1`)).toBe(true)
    expect(ids.has(`${PREFIX}scheduled`)).toBe(false)
    expect(ids.has(`${PREFIX}suspended-post`)).toBe(false)
    expect(ids.has(`${PREFIX}deleted-post`)).toBe(false)
  })

  it('never shows an email address as the author name', async () => {
    const story = (await collectStories(30)).find((s) => s.id === `${PREFIX}email-post`)
    expect(story?.author.displayName).toBe('community-stories-emailname')
    expect(JSON.stringify(story)).not.toContain('@example.com')
  })

  it('truncates long bodies to a 280-character excerpt ending in an ellipsis', async () => {
    const story = (await collectStories(30)).find((s) => s.id === `${PREFIX}p4`)
    expect(story).toBeDefined()
    expect(Array.from(story!.excerpt).length).toBeLessThanOrEqual(280)
    expect(story!.excerpt.endsWith('…')).toBe(true)
    expect(story!.excerpt).not.toMatch(/\s{2,}/)
  })

  it('pages newest first by publishAt then id without gaps or repeats', async () => {
    const stories = await collectStories(2)
    const ids = stories.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)

    const mine = ids.filter((id) => /^community-stories-p\d$/.test(id))
    expect(mine).toEqual([
      `${PREFIX}p5`,
      `${PREFIX}p4`,
      `${PREFIX}p3`,
      `${PREFIX}p2`,
      `${PREFIX}p1`,
    ])

    for (let i = 1; i < stories.length; i++) {
      expect(stories[i - 1]!.publishAt >= stories[i]!.publishAt).toBe(true)
    }
  })

  it('returns nextCursor = null on the last page', async () => {
    const stories = await collectStories(30)
    const lastId = stories[stories.length - 1]!.id
    const { body } = await getPage(`?limit=30&cursor=${lastId}`)
    expect(body.items).toEqual([])
    expect(body.nextCursor).toBeNull()
  })

  it('clamps limit to 30 and rejects an unknown cursor or a zero limit', async () => {
    const big = await getPage('?limit=500')
    expect(big.res.statusCode).toBe(200)
    expect(big.body.items.length).toBeLessThanOrEqual(30)

    const badCursor = await getPage('?cursor=does-not-exist')
    expect(badCursor.res.statusCode).toBe(400)

    const zero = await app.inject({ method: 'GET', url: `${URL}?limit=0` })
    expect(zero.statusCode).toBe(400)
  })
})
