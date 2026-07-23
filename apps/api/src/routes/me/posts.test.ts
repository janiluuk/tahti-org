// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma, processScheduledPostNotifications } from '@tahti/db'
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

  it('saves an optional link and rejects a malformed one', async () => {
    const good = await app.inject({
      method: 'POST',
      url: '/api/me/posts',
      headers: { cookie: artistCookie },
      payload: { body: 'Check this out', linkUrl: 'https://example.com/x', linkLabel: 'Tickets' },
    })
    expect(good.statusCode).toBe(201)
    const post = good.json() as { linkUrl: string; linkLabel: string }
    expect(post.linkUrl).toBe('https://example.com/x')
    expect(post.linkLabel).toBe('Tickets')

    const bad = await app.inject({
      method: 'POST',
      url: '/api/me/posts',
      headers: { cookie: artistCookie },
      payload: { body: 'Bad link', linkUrl: 'not-a-url' },
    })
    expect(bad.statusCode).toBe(400)
  })

  it('notifies followers immediately when a post publishes right away, not for a scheduled one', async () => {
    const follower = await createTestArtist(prisma, {
      email: `${PREFIX}follower@example.com`,
      username: 'artist-posts-follower',
    })
    const artist = await prisma.user.findFirstOrThrow({
      where: { channel: { slug: artistSlug } },
    })
    await prisma.artistFollow.create({
      data: { followerUserId: follower.id, artistUserId: artist.id },
    })

    const immediate = await app.inject({
      method: 'POST',
      url: '/api/me/posts',
      headers: { cookie: artistCookie },
      payload: { body: 'Notify my followers now' },
    })
    expect(immediate.statusCode).toBe(201)

    const notif = await prisma.notification.findFirst({
      where: { userId: follower.id, type: 'NEW_POST', title: { contains: 'posted an update' } },
    })
    expect(notif).toBeTruthy()
    expect(notif?.readAt).toBeNull()

    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    const scheduled = await app.inject({
      method: 'POST',
      url: '/api/me/posts',
      headers: { cookie: artistCookie },
      payload: { body: 'Not yet — scheduled', publishAt: future },
    })
    expect(scheduled.statusCode).toBe(201)
    const scheduledPost = await prisma.artistPost.findUniqueOrThrow({
      where: { id: scheduled.json().id },
    })
    expect(scheduledPost.notifiedAt).toBeNull()

    const notifCountAfterSchedule = await prisma.notification.count({
      where: { userId: follower.id, type: 'NEW_POST' },
    })
    // Still just the one from the immediate post — nothing for the scheduled one yet.
    expect(notifCountAfterSchedule).toBe(1)
  })

  it('processScheduledPostNotifications notifies followers once a scheduled post crosses publishAt', async () => {
    const follower = await createTestArtist(prisma, {
      email: `${PREFIX}cron-follower@example.com`,
      username: 'artist-posts-cron-follower',
    })
    const artist = await prisma.user.findFirstOrThrow({
      where: { channel: { slug: artistSlug } },
    })
    await prisma.artistFollow.upsert({
      where: {
        followerUserId_artistUserId: { followerUserId: follower.id, artistUserId: artist.id },
      },
      create: { followerUserId: follower.id, artistUserId: artist.id },
      update: {},
    })

    const duePost = await prisma.artistPost.create({
      data: {
        userId: artist.id,
        body: 'This one just crossed publishAt',
        publishAt: new Date(Date.now() - 1000),
      },
    })

    const summary = await processScheduledPostNotifications(prisma)
    expect(summary.notified).toBeGreaterThanOrEqual(1)

    const updated = await prisma.artistPost.findUniqueOrThrow({ where: { id: duePost.id } })
    expect(updated.notifiedAt).not.toBeNull()

    const notif = await prisma.notification.findFirst({
      where: { userId: follower.id, type: 'NEW_POST', body: { contains: 'crossed publishAt' } },
    })
    expect(notif).toBeTruthy()

    // Running it again must not double-notify (notifiedAt already set excludes it).
    const secondSummary = await processScheduledPostNotifications(prisma)
    const notifCount = await prisma.notification.count({
      where: { userId: follower.id, body: { contains: 'crossed publishAt' } },
    })
    expect(notifCount).toBe(1)
    void secondSummary
  })
})
