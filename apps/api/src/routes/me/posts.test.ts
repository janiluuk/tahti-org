// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'artist-posts-'

describe('Artist posts: scheduling and publish-time filtering', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let artistCookie: string
  let artistSlug: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'artist-posts-writer',
    })
    artistCookie = await sessionCookieFor(prisma, artist.id)
    artistSlug = artist.channel!.slug
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('publishes immediately when publishAt is omitted', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/posts',
      headers: { cookie: artistCookie },
      payload: { body: 'Hello, this is live right away.' },
    })
    expect(res.statusCode).toBe(201)
    const post = res.json() as { publishAt: string; createdAt: string }
    expect(new Date(post.publishAt).getTime()).toBeLessThanOrEqual(Date.now())

    const publicRes = await app.inject({
      method: 'GET',
      url: `/api/channels/${artistSlug}/posts`,
    })
    expect(publicRes.statusCode).toBe(200)
    const publicPosts = publicRes.json() as Array<{ body: string }>
    expect(publicPosts.some((p) => p.body === 'Hello, this is live right away.')).toBe(true)
  })

  it('hides a future-dated post from the public feed until publishAt passes', async () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    const created = await app.inject({
      method: 'POST',
      url: '/api/me/posts',
      headers: { cookie: artistCookie },
      payload: { body: 'Scheduled announcement, not out yet.', publishAt: future },
    })
    expect(created.statusCode).toBe(201)
    const post = created.json() as { id: string; publishAt: string }
    expect(post.publishAt).toBe(future)

    const publicRes = await app.inject({
      method: 'GET',
      url: `/api/channels/${artistSlug}/posts`,
    })
    const publicPosts = publicRes.json() as Array<{ body: string }>
    expect(publicPosts.some((p) => p.body === 'Scheduled announcement, not out yet.')).toBe(false)

    // Still visible to the owner in their own dashboard list, so they can see it's queued.
    const ownRes = await app.inject({
      method: 'GET',
      url: '/api/me/posts',
      headers: { cookie: artistCookie },
    })
    const ownPosts = ownRes.json() as Array<{ id: string }>
    expect(ownPosts.some((p) => p.id === post.id)).toBe(true)
  })

  it('rejects a scheduled post that is not valid ISO datetime', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/posts',
      headers: { cookie: artistCookie },
      payload: { body: 'Bad schedule value', publishAt: 'not-a-date' },
    })
    expect(res.statusCode).toBe(400)
  })
})
