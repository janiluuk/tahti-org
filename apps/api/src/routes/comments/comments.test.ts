// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@tahti/db'
import { buildApp } from '../../server.js'
import { cleanupUsersByEmailPrefix, createTestArtist, sessionCookieFor } from '../../test/helpers.js'

const PREFIX = 'comments-test-'

describe('/api/comments — tracks and channels', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let ownerCookie: string
  let otherCookie: string
  let channelSlug: string
  let archiveItemId: string

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

    const item = await prisma.archiveItem.create({
      data: {
        channelId: owner.channel!.id,
        title: 'Comment Test Track',
        status: 'READY',
        isPublic: true,
      },
    })
    archiveItemId = item.id
  })

  afterAll(async () => {
    await app.close()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
  })

  it('lists an empty, enabled comment section for a fresh track', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/comments/track/${archiveItemId}` })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ comments: [], commentsEnabled: true })
  })

  it('requires auth to post a track comment', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/comments/track/${archiveItemId}`,
      payload: { body: 'nice track' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('posts and lists a track comment', async () => {
    const post = await app.inject({
      method: 'POST',
      url: `/api/comments/track/${archiveItemId}`,
      headers: { cookie: otherCookie, 'content-type': 'application/json' },
      payload: { body: 'nice track' },
    })
    expect(post.statusCode).toBe(201)
    expect(post.json().body).toBe('nice track')
    expect(post.json().authorUsername).toBe(`${PREFIX}other`)

    const list = await app.inject({ method: 'GET', url: `/api/comments/track/${archiveItemId}` })
    expect(list.json().comments).toHaveLength(1)
    expect(list.json().comments[0].body).toBe('nice track')
  })

  it('lets the track owner disable comments via the archive metadata patch', async () => {
    const patch = await app.inject({
      method: 'PATCH',
      url: `/api/me/archive/${archiveItemId}`,
      headers: { cookie: ownerCookie, 'content-type': 'application/json' },
      payload: { commentsEnabled: false },
    })
    expect(patch.statusCode).toBe(200)
    expect(patch.json().commentsEnabled).toBe(false)

    const list = await app.inject({ method: 'GET', url: `/api/comments/track/${archiveItemId}` })
    expect(list.json().commentsEnabled).toBe(false)

    const post = await app.inject({
      method: 'POST',
      url: `/api/comments/track/${archiveItemId}`,
      headers: { cookie: otherCookie, 'content-type': 'application/json' },
      payload: { body: 'still trying' },
    })
    expect(post.statusCode).toBe(403)

    // re-enable for the rest of the suite
    await app.inject({
      method: 'PATCH',
      url: `/api/me/archive/${archiveItemId}`,
      headers: { cookie: ownerCookie, 'content-type': 'application/json' },
      payload: { commentsEnabled: true },
    })
  })

  it('lets the comment author delete their own comment', async () => {
    const post = await app.inject({
      method: 'POST',
      url: `/api/comments/track/${archiveItemId}`,
      headers: { cookie: otherCookie, 'content-type': 'application/json' },
      payload: { body: 'delete me' },
    })
    const commentId = post.json().id

    const forbidden = await app.inject({
      method: 'DELETE',
      url: `/api/comments/${commentId}`,
      headers: { cookie: ownerCookie },
    })
    // owner may also delete (moderation) — only assert the AUTHOR can delete their own
    expect([204, 403]).toContain(forbidden.statusCode)

    const del = await app.inject({
      method: 'DELETE',
      url: `/api/comments/${commentId}`,
      headers: { cookie: otherCookie },
    })
    expect(del.statusCode).toBe(204)
  })

  it('lets the channel owner delete any comment on their track', async () => {
    const post = await app.inject({
      method: 'POST',
      url: `/api/comments/track/${archiveItemId}`,
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

    const created = await prisma.archiveItem.findUniqueOrThrow({
      where: { id: complete.json().itemId },
      select: { commentsEnabled: true },
    })
    expect(created.commentsEnabled).toBe(false)
  })
})
