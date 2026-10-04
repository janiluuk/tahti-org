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

const PREFIX = 'comments-test-'

describe('/api/comments — tracks and channels', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let ownerCookie: string
  let otherCookie: string
  let channelSlug: string
  let soundId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const owner = await createTestArtist(prisma, {
      email: `${PREFIX}owner@example.com`,
      username: `${PREFIX}owner`,
      displayName: 'Comment Test Owner',
    })
    channelSlug = owner.channel!.slug
    ownerCookie = await sessionCookieFor(prisma, owner.id)

    const other = await createTestArtist(prisma, {
      email: `${PREFIX}other@example.com`,
      username: `${PREFIX}other`,
      displayName: 'Comment Test Other',
    })
    otherCookie = await sessionCookieFor(prisma, other.id)

    const item = await prisma.sound.create({
      data: {
        channelId: owner.channel!.id,
        title: 'Comment Test Track',
        status: 'READY',
        isPublic: true,
      },
    })
    soundId = item.id
  })

  afterAll(async () => {
    await app.close()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
  })

  it('lists an empty, enabled comment section for a fresh track', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/comments/track/${soundId}` })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ comments: [], commentsEnabled: true })
  })

  it('requires auth to post a track comment', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/comments/track/${soundId}`,
      payload: { body: 'nice track' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('posts and lists a track comment', async () => {
    const post = await app.inject({
      method: 'POST',
      url: `/api/comments/track/${soundId}`,
      headers: { cookie: otherCookie, 'content-type': 'application/json' },
      payload: { body: 'nice track' },
    })
    expect(post.statusCode).toBe(201)
    expect(post.json().body).toBe('nice track')
    expect(post.json().authorUsername).toBe(`${PREFIX}other`)

    const list = await app.inject({ method: 'GET', url: `/api/comments/track/${soundId}` })
    expect(list.json().comments).toHaveLength(1)
    expect(list.json().comments[0].body).toBe('nice track')
  })

  it('lets the track owner disable comments via the sound metadata patch', async () => {
    const patch = await app.inject({
      method: 'PATCH',
      url: `/api/me/sound/${soundId}`,
      headers: { cookie: ownerCookie, 'content-type': 'application/json' },
      payload: { commentsEnabled: false },
    })
    expect(patch.statusCode).toBe(200)
    expect(patch.json().commentsEnabled).toBe(false)

    const list = await app.inject({ method: 'GET', url: `/api/comments/track/${soundId}` })
    expect(list.json().commentsEnabled).toBe(false)

    const post = await app.inject({
      method: 'POST',
      url: `/api/comments/track/${soundId}`,
      headers: { cookie: otherCookie, 'content-type': 'application/json' },
      payload: { body: 'still trying' },
    })
    expect(post.statusCode).toBe(403)

    // re-enable for the rest of the suite
    await app.inject({
      method: 'PATCH',
      url: `/api/me/sound/${soundId}`,
      headers: { cookie: ownerCookie, 'content-type': 'application/json' },
      payload: { commentsEnabled: true },
    })
  })

  it('lets the comment author delete their own comment', async () => {
    const post = await app.inject({
      method: 'POST',
      url: `/api/comments/track/${soundId}`,
      headers: { cookie: otherCookie, 'content-type': 'application/json' },
      payload: { body: 'delete me' },
    })
    const commentId = post.json().id

    const del = await app.inject({
      method: 'DELETE',
      url: `/api/comments/${commentId}`,
      headers: { cookie: otherCookie },
    })
    expect(del.statusCode).toBe(204)
  })

  it('forbids a third party from deleting someone else’s comment', async () => {
    const post = await app.inject({
      method: 'POST',
      url: `/api/comments/track/${soundId}`,
      headers: { cookie: otherCookie, 'content-type': 'application/json' },
      payload: { body: 'not yours to delete' },
    })
    const commentId = post.json().id

    const thirdParty = await createTestArtist(prisma, {
      email: `${PREFIX}third@example.com`,
      username: `${PREFIX}third`,
      displayName: 'Comment Test Third Party',
    })
    const thirdCookie = await sessionCookieFor(prisma, thirdParty.id)

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/comments/${commentId}`,
      headers: { cookie: thirdCookie },
    })
    expect(res.statusCode).toBe(403)
  })

  it('lets the channel owner delete any comment on their track', async () => {
    const post = await app.inject({
      method: 'POST',
      url: `/api/comments/track/${soundId}`,
      headers: { cookie: otherCookie, 'content-type': 'application/json' },
      payload: { body: 'owner will remove this' },
    })
    const commentId = post.json().id

    const del = await app.inject({
      method: 'DELETE',
      url: `/api/comments/${commentId}`,
      headers: { cookie: ownerCookie },
    })
    expect(del.statusCode).toBe(204)
  })

  it('lists and posts channel-level comments', async () => {
    const list = await app.inject({ method: 'GET', url: `/api/comments/channel/${channelSlug}` })
    expect(list.statusCode).toBe(200)
    expect(list.json()).toEqual({ comments: [], commentsEnabled: true })

    const post = await app.inject({
      method: 'POST',
      url: `/api/comments/channel/${channelSlug}`,
      headers: { cookie: otherCookie, 'content-type': 'application/json' },
      payload: { body: 'love the channel' },
    })
    expect(post.statusCode).toBe(201)

    const after = await app.inject({ method: 'GET', url: `/api/comments/channel/${channelSlug}` })
    expect(after.json().comments).toHaveLength(1)
  })

  it('lets the owner toggle channel comments off via /api/me/comments/channel', async () => {
    const patch = await app.inject({
      method: 'PATCH',
      url: '/api/me/comments/channel',
      headers: { cookie: ownerCookie, 'content-type': 'application/json' },
      payload: { commentsEnabled: false },
    })
    expect(patch.statusCode).toBe(200)
    expect(patch.json().commentsEnabled).toBe(false)

    const post = await app.inject({
      method: 'POST',
      url: `/api/comments/channel/${channelSlug}`,
      headers: { cookie: otherCookie, 'content-type': 'application/json' },
      payload: { body: 'blocked' },
    })
    expect(post.statusCode).toBe(403)
  })

  it('reads and patches the caller’s own comment defaults', async () => {
    const get = await app.inject({
      method: 'GET',
      url: '/api/me/comments/defaults',
      headers: { cookie: ownerCookie },
    })
    expect(get.statusCode).toBe(200)
    expect(get.json()).toEqual({
      defaultTrackCommentsEnabled: true,
      defaultChannelCommentsEnabled: true,
    })

    const patch = await app.inject({
      method: 'PATCH',
      url: '/api/me/comments/defaults',
      headers: { cookie: ownerCookie, 'content-type': 'application/json' },
      payload: { defaultTrackCommentsEnabled: false },
    })
    expect(patch.statusCode).toBe(200)
    expect(patch.json()).toEqual({
      defaultTrackCommentsEnabled: false,
      defaultChannelCommentsEnabled: true,
    })
  })

  it('seeds a new track from the caller’s defaultTrackCommentsEnabled', async () => {
    // owner's default was just set to false above
    const prepare = await app.inject({
      method: 'POST',
      url: '/api/uploads/prepare',
      headers: { cookie: ownerCookie, 'content-type': 'application/json' },
      payload: {
        filename: 'defaults-test.mp3',
        contentType: 'audio/mpeg',
        fileSizeBytes: 1024,
        title: 'Defaults Test Track',
      },
    })
    expect(prepare.statusCode).toBe(200)
    const { uploadId } = prepare.json() as { uploadId: string }

    const complete = await app.inject({
      method: 'POST',
      url: '/api/uploads/complete',
      headers: { cookie: ownerCookie, 'content-type': 'application/json' },
      payload: { uploadId, etag: 'test-etag', title: 'Defaults Test Track' },
    })
    expect(complete.statusCode).toBe(201)

    const created = await prisma.sound.findUniqueOrThrow({
      where: { id: complete.json().itemId },
      select: { commentsEnabled: true },
    })
    expect(created.commentsEnabled).toBe(false)
  })
})

describe('/api/comments — author names', () => {
  const MAIL_PREFIX = 'comments-mail-test-'
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, MAIL_PREFIX)
  })

  afterAll(async () => {
    await app.close()
    await cleanupUsersByEmailPrefix(prisma, MAIL_PREFIX)
  })

  it('never shows an email address as the comment author name', async () => {
    const owner = await createTestArtist(prisma, {
      email: `${MAIL_PREFIX}owner@example.com`,
      username: `${MAIL_PREFIX}owner`,
    })
    const author = await createTestArtist(prisma, {
      email: `${MAIL_PREFIX}author@example.com`,
      username: `${MAIL_PREFIX}author`,
      displayName: `${MAIL_PREFIX}author@example.com`,
    })
    const cookie = await sessionCookieFor(prisma, author.id)
    const sound = await prisma.sound.create({
      data: { channelId: owner.channel!.id, title: 'Mail track', status: 'READY', isPublic: true },
    })

    const trackPost = await app.inject({
      method: 'POST',
      url: `/api/comments/track/${sound.id}`,
      headers: { cookie, 'content-type': 'application/json' },
      payload: { body: 'hello' },
    })
    expect(trackPost.statusCode).toBe(201)
    expect(trackPost.json().authorDisplayName).toBe(`${MAIL_PREFIX}author`)

    const channelPost = await app.inject({
      method: 'POST',
      url: `/api/comments/channel/${owner.channel!.slug}`,
      headers: { cookie, 'content-type': 'application/json' },
      payload: { body: 'hello channel' },
    })
    expect(channelPost.statusCode).toBe(201)
    expect(channelPost.json().authorDisplayName).toBe(`${MAIL_PREFIX}author`)

    for (const url of [
      `/api/comments/track/${sound.id}`,
      `/api/comments/channel/${owner.channel!.slug}`,
    ]) {
      const list = await app.inject({ method: 'GET', url })
      expect(list.json().comments[0].authorDisplayName).toBe(`${MAIL_PREFIX}author`)
    }
  })
})

describe('/api/comments — long threads and unavailable authors', () => {
  const P = 'comments-long-test-'
  let app: Awaited<ReturnType<typeof buildApp>>
  let soundId: string
  let authorId: string
  let goneId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, P)
    const owner = await createTestArtist(prisma, {
      email: `${P}owner@example.com`,
      username: `${P}owner`,
      displayName: 'Long Thread Owner',
    })
    const author = await createTestArtist(prisma, {
      email: `${P}author@example.com`,
      username: `${P}author`,
      displayName: 'Long Thread Author',
    })
    authorId = author.id
    const gone = await createTestArtist(prisma, {
      email: `${P}gone@example.com`,
      username: `${P}gone`,
      displayName: 'Long Thread Gone',
    })
    goneId = gone.id
    const item = await prisma.sound.create({
      data: {
        channelId: owner.channel!.id,
        title: 'Long Thread Track',
        status: 'READY',
        isPublic: true,
      },
    })
    soundId = item.id
  })

  afterAll(async () => {
    await app.close()
    await cleanupUsersByEmailPrefix(prisma, P)
  })

  it('keeps the newest comments when a thread is longer than the limit', async () => {
    const start = Date.now() - 1_000_000
    await prisma.comment.createMany({
      data: Array.from({ length: 205 }, (_, i) => ({
        body: `comment ${i}`,
        authorId,
        soundId,
        createdAt: new Date(start + i * 1000),
      })),
    })
    const res = await app.inject({ method: 'GET', url: `/api/comments/track/${soundId}` })
    const bodies = (res.json().comments as Array<{ body: string }>).map((c) => c.body)
    expect(bodies).toHaveLength(200)
    expect(bodies[0]).toBe('comment 5')
    expect(bodies[199]).toBe('comment 204')
  })

  it('leaves out comments from suspended and deleted accounts', async () => {
    await prisma.comment.create({
      data: { body: 'from a gone account', authorId: goneId, soundId },
    })
    const listed = async () =>
      (
        (await app.inject({ method: 'GET', url: `/api/comments/track/${soundId}` })).json()
          .comments as Array<{ body: string }>
      ).some((c) => c.body === 'from a gone account')
    expect(await listed()).toBe(true)

    await prisma.user.update({ where: { id: goneId }, data: { suspendedAt: new Date() } })
    expect(await listed()).toBe(false)

    await prisma.user.update({
      where: { id: goneId },
      data: { suspendedAt: null, deletedAt: new Date() },
    })
    expect(await listed()).toBe(false)
  })

  it('lets a board member delete a comment', async () => {
    const board = await createTestArtist(prisma, {
      email: `${P}board@example.com`,
      username: `${P}board`,
      displayName: 'Long Thread Board',
    })
    await prisma.user.update({ where: { id: board.id }, data: { isBoard: true } })
    const comment = await prisma.comment.create({
      data: { body: 'to be moderated', authorId, soundId },
    })
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/comments/${comment.id}`,
      headers: { cookie: await sessionCookieFor(prisma, board.id) },
    })
    expect(res.statusCode).toBe(204)
    expect(await prisma.comment.findUnique({ where: { id: comment.id } })).toBeNull()
  })
})
