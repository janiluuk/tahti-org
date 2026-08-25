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

const PREFIX = 'archive-like-test-'

describe('archive item like routes', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let channelSlug: string
  let itemId: string
  let itemTitle: string
  let likerId: string
  let likerCookie: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const owner = await createTestArtist(prisma, {
      email: `${PREFIX}owner@example.com`,
      username: `${PREFIX}owner`,
      displayName: 'Like Test Owner',
    })
    channelSlug = owner.channel!.slug

    const item = await prisma.archiveItem.create({
      data: {
        channelId: owner.channel!.id,
        title: 'Likeable Track',
        status: 'READY',
        isPublic: true,
      },
    })
    itemId = item.id
    itemTitle = item.title

    const liker = await createTestArtist(prisma, {
      email: `${PREFIX}liker@example.com`,
      username: `${PREFIX}liker`,
      displayName: 'Liker',
    })
    likerId = liker.id
    likerCookie = await sessionCookieFor(prisma, liker.id)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('GET reports liked:false and count 0 with no session and no likes', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/c/${channelSlug}/archive/${itemId}/like`,
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ liked: false, likeCount: 0 })
  })

  it('POST requires auth', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/c/${channelSlug}/archive/${itemId}/like`,
    })
    expect(res.statusCode).toBe(401)
  })

  it('POST likes the track, bumps the count, and writes one ARCHIVE_ITEM_LIKE audit row', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/c/${channelSlug}/archive/${itemId}/like`,
      headers: { cookie: likerCookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ liked: true, likeCount: 1 })

    const rows = await prisma.auditLog.findMany({
      where: { action: 'ARCHIVE_ITEM_LIKE', actorId: likerId, targetId: itemId },
    })
    expect(rows).toHaveLength(1)
    expect(rows[0]?.meta).toMatchObject({ title: itemTitle, channelSlug })
  })

  it('a repeat POST does not double-count or write a second audit row', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/c/${channelSlug}/archive/${itemId}/like`,
      headers: { cookie: likerCookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ liked: true, likeCount: 1 })

    const rows = await prisma.auditLog.findMany({
      where: { action: 'ARCHIVE_ITEM_LIKE', actorId: likerId, targetId: itemId },
    })
    expect(rows).toHaveLength(1)
  })

  it('DELETE unlikes and brings the count back to 0', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/c/${channelSlug}/archive/${itemId}/like`,
      headers: { cookie: likerCookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ liked: false, likeCount: 0 })
  })

  it('404s for an unknown archive item', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/c/${channelSlug}/archive/not-a-real-id/like`,
      headers: { cookie: likerCookie },
    })
    expect(res.statusCode).toBe(404)
  })
})
