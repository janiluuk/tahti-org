// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@tahti/db'
import { buildApp } from '../../server.js'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'me-blocks-test-'

describe('/api/me/blocks', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookieA: string
  let cookieB: string
  let conversationId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const a = await createTestArtist(prisma, {
      email: `${PREFIX}a@example.com`,
      username: `${PREFIX}a`,
      displayName: 'Block Alex',
    })
    const b = await createTestArtist(prisma, {
      email: `${PREFIX}b@example.com`,
      username: `${PREFIX}b`,
      displayName: 'b-hidden@example.com',
    })
    cookieA = await sessionCookieFor(prisma, a.id)
    cookieB = await sessionCookieFor(prisma, b.id)
    const started = await app.inject({
      method: 'POST',
      url: '/api/me/messages/conversations',
      headers: { cookie: cookieA },
      payload: { username: `${PREFIX}b` },
    })
    conversationId = started.json().conversationId
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  const send = (cookie: string) =>
    app.inject({
      method: 'POST',
      url: `/api/me/messages/conversations/${conversationId}/messages`,
      headers: { cookie },
      payload: { body: 'hello' },
    })

  it('requires auth and refuses blocking yourself or nobody', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/me/blocks' })).statusCode).toBe(401)
    const self = await app.inject({
      method: 'POST',
      url: '/api/me/blocks',
      headers: { cookie: cookieA },
      payload: { username: `${PREFIX}a` },
    })
    expect(self.statusCode).toBe(400)
    const nobody = await app.inject({
      method: 'POST',
      url: '/api/me/blocks',
      headers: { cookie: cookieA },
      payload: { username: `${PREFIX}nobody` },
    })
    expect(nobody.statusCode).toBe(404)
  })

  it('blocks an account, lists it with a safe name, and is fine to repeat', async () => {
    expect((await send(cookieB)).statusCode).toBe(201)

    for (let i = 0; i < 2; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/me/blocks',
        headers: { cookie: cookieA },
        payload: { username: `${PREFIX}b` },
      })
      expect(res.statusCode).toBe(201)
    }
    const list = await app.inject({
      method: 'GET',
      url: '/api/me/blocks',
      headers: { cookie: cookieA },
    })
    expect(list.json().blocked).toHaveLength(1)
    expect(list.json().blocked[0]).toMatchObject({
      username: `${PREFIX}b`,
      displayName: `${PREFIX}b`,
    })
    expect(list.body).not.toContain('@example.com')

    const theirs = await app.inject({
      method: 'GET',
      url: '/api/me/blocks',
      headers: { cookie: cookieB },
    })
    expect(theirs.json().blocked).toEqual([])
  })

  it('stops direct messages in both directions without saying who blocked', async () => {
    const fromBlocked = await send(cookieB)
    const fromBlocker = await send(cookieA)
    expect(fromBlocked.statusCode).toBe(403)
    expect(fromBlocker.statusCode).toBe(403)
    expect(fromBlocked.json()).toEqual(fromBlocker.json())

    const restart = await app.inject({
      method: 'POST',
      url: '/api/me/messages/conversations',
      headers: { cookie: cookieB },
      payload: { username: `${PREFIX}a` },
    })
    expect(restart.statusCode).toBe(403)
  })

  it('also stops comments and follows between the two, and drops existing follows', async () => {
    const a = await prisma.user.findUniqueOrThrow({
      where: { username: `${PREFIX}a` },
      select: { id: true, channel: { select: { id: true, slug: true } } },
    })
    const b = await prisma.user.findUniqueOrThrow({ where: { username: `${PREFIX}b` } })
    const track = await prisma.sound.create({
      data: { channelId: a.channel!.id, title: 'Blocked Track', status: 'READY', isPublic: true },
    })
    // Unblock, follow, then block again: the follow must not survive the block.
    await app.inject({
      method: 'DELETE',
      url: `/api/me/blocks/${PREFIX}b`,
      headers: { cookie: cookieA },
    })
    const followed = await app.inject({
      method: 'POST',
      url: `/api/v1/artists/${PREFIX}a/follow`,
      headers: { cookie: cookieB },
    })
    expect(followed.statusCode).toBe(200)
    await app.inject({
      method: 'POST',
      url: '/api/me/blocks',
      headers: { cookie: cookieA },
      payload: { username: `${PREFIX}b` },
    })
    expect(
      await prisma.artistFollow.count({ where: { followerUserId: b.id, artistUserId: a.id } }),
    ).toBe(0)

    const refollow = await app.inject({
      method: 'POST',
      url: `/api/v1/artists/${PREFIX}a/follow`,
      headers: { cookie: cookieB },
    })
    expect(refollow.statusCode).toBe(404)

    const onTrack = await app.inject({
      method: 'POST',
      url: `/api/comments/track/${track.id}`,
      headers: { cookie: cookieB },
      payload: { body: 'let me in' },
    })
    expect(onTrack.statusCode).toBe(403)
    const onChannel = await app.inject({
      method: 'POST',
      url: `/api/comments/channel/${a.channel!.slug}`,
      headers: { cookie: cookieB },
      payload: { body: 'let me in' },
    })
    expect(onChannel.statusCode).toBe(403)
    expect(await prisma.comment.count({ where: { authorId: b.id } })).toBe(0)
  })

  it('hides the two from each other in user search and hides earlier comments', async () => {
    const a = await prisma.user.findUniqueOrThrow({
      where: { username: `${PREFIX}a` },
      select: { id: true, channel: { select: { id: true } } },
    })
    const b = await prisma.user.findUniqueOrThrow({ where: { username: `${PREFIX}b` } })
    const track = await prisma.sound.create({
      data: { channelId: a.channel!.id, title: 'Old Thread', status: 'READY', isPublic: true },
    })
    await prisma.comment.create({
      data: { body: 'written before', authorId: b.id, soundId: track.id },
    })

    const search = async (cookie: string, q: string) =>
      (
        (
          await app.inject({
            method: 'GET',
            url: `/api/users/search?q=${encodeURIComponent(q)}`,
            headers: { cookie },
          })
        ).json() as Array<{ username: string }>
      ).map((u) => u.username)
    expect(await search(cookieA, `${PREFIX}b`)).toEqual([])
    expect(await search(cookieB, `${PREFIX}a`)).toEqual([])

    const listed = async () =>
      (
        (await app.inject({ method: 'GET', url: `/api/comments/track/${track.id}` })).json()
          .comments as Array<{ body: string }>
      ).map((c) => c.body)
    expect(await listed()).toEqual([])

    await app.inject({
      method: 'DELETE',
      url: `/api/me/blocks/${PREFIX}b`,
      headers: { cookie: cookieA },
    })
    expect(await listed()).toEqual(['written before'])
    expect(await search(cookieA, `${PREFIX}b`)).toEqual([`${PREFIX}b`])
    await app.inject({
      method: 'POST',
      url: '/api/me/blocks',
      headers: { cookie: cookieA },
      payload: { username: `${PREFIX}b` },
    })
  })

  it('does not notify the blocker when the blocked account loves their track', async () => {
    const a = await prisma.user.findUniqueOrThrow({
      where: { username: `${PREFIX}a` },
      select: { id: true, channel: { select: { id: true, slug: true } } },
    })
    const b = await prisma.user.findUniqueOrThrow({ where: { username: `${PREFIX}b` } })
    const track = await prisma.sound.create({
      data: { channelId: a.channel!.id, title: 'Quiet Love', status: 'READY', isPublic: true },
    })
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/c/${a.channel!.slug}/sounds/${track.id}/like`,
      headers: { cookie: cookieB },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().liked).toBe(true)
    expect(
      await prisma.notification.count({
        where: { userId: a.id, actorUserId: b.id, type: 'NEW_LIKE' },
      }),
    ).toBe(0)
  })

  it('lets them talk again after an unblock', async () => {
    const unblock = await app.inject({
      method: 'DELETE',
      url: `/api/me/blocks/${PREFIX}b`,
      headers: { cookie: cookieA },
    })
    expect(unblock.statusCode).toBe(204)
    expect((await send(cookieB)).statusCode).toBe(201)
    expect((await send(cookieA)).statusCode).toBe(201)
  })
})
