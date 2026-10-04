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

const PREFIX = 'notif-inbox-'

describe('GET/POST /api/me/notifications', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let userId: string
  let actorId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const recipient = await createTestArtist(prisma, {
      email: `${PREFIX}recipient@example.com`,
      username: 'notif-inbox-recipient',
    })
    const actor = await createTestArtist(prisma, {
      email: `${PREFIX}actor@example.com`,
      username: 'notif-inbox-actor',
    })
    userId = recipient.id
    actorId = actor.id
    cookie = await sessionCookieFor(prisma, recipient.id)

    await prisma.notification.createMany({
      data: [
        {
          userId,
          type: 'NEW_POST',
          actorUserId: actorId,
          title: 'Actor posted an update',
          body: 'Hello world',
          url: '/u/notif-inbox-actor',
        },
        {
          userId,
          type: 'NEW_POST',
          actorUserId: actorId,
          title: 'Actor posted again',
          body: null,
          url: '/u/notif-inbox-actor',
        },
      ],
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/me/notifications' })
    expect(res.statusCode).toBe(401)
  })

  it('lists notifications newest first with an unread count', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/notifications',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as {
      notifications: Array<{ title: string; readAt: string | null }>
      unreadCount: number
    }
    expect(body.notifications).toHaveLength(2)
    expect(body.unreadCount).toBe(2)
    expect(body.notifications[0]!.readAt).toBeNull()
  })

  it('honours ?limit and pages older ones with ?before', async () => {
    const all = await app.inject({
      method: 'GET',
      url: '/api/me/notifications',
      headers: { cookie },
    })
    const ids = (all.json().notifications as Array<{ id: string }>).map((n) => n.id)
    expect(ids.length).toBeGreaterThanOrEqual(2)
    expect(all.json().hasMore).toBe(false)

    const first = await app.inject({
      method: 'GET',
      url: '/api/me/notifications?limit=1',
      headers: { cookie },
    })
    expect(first.statusCode).toBe(200)
    expect(first.json().notifications.map((n: { id: string }) => n.id)).toEqual([ids[0]])
    expect(first.json().hasMore).toBe(true)

    const older = await app.inject({
      method: 'GET',
      url: `/api/me/notifications?limit=50&before=${ids[0]}`,
      headers: { cookie },
    })
    expect(older.statusCode).toBe(200)
    expect(older.json().notifications.map((n: { id: string }) => n.id)).toEqual(ids.slice(1))
    expect(older.json().hasMore).toBe(false)
  })

  it("rejects a bad limit and another user's cursor", async () => {
    const bad = await app.inject({
      method: 'GET',
      url: '/api/me/notifications?limit=500',
      headers: { cookie },
    })
    expect(bad.statusCode).toBe(400)

    const foreign = await prisma.notification.create({
      data: { userId: actorId, type: 'NEW_POST', title: 'Not yours' },
    })
    const res = await app.inject({
      method: 'GET',
      url: `/api/me/notifications?before=${foreign.id}`,
      headers: { cookie },
    })
    expect(res.statusCode).toBe(400)
  })

  it('marks everything read', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/notifications/read-all',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(204)

    const after = await app.inject({
      method: 'GET',
      url: '/api/me/notifications',
      headers: { cookie },
    })
    const body = after.json() as { unreadCount: number }
    expect(body.unreadCount).toBe(0)
  })

  it('leaves sticky notifications unread after read-all', async () => {
    await prisma.notification.create({
      data: {
        userId,
        type: 'THEME_UNDER_REVIEW',
        title: 'Theme is in review',
        body: 'An admin will decide soon.',
        url: '/dashboard/settings/themes',
        sticky: true,
      },
    })

    const res = await app.inject({
      method: 'POST',
      url: '/api/me/notifications/read-all',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(204)

    const after = await app.inject({
      method: 'GET',
      url: '/api/me/notifications',
      headers: { cookie },
    })
    const body = after.json() as {
      notifications: Array<{ sticky: boolean; readAt: string | null; title: string }>
      unreadCount: number
    }
    const sticky = body.notifications.find((item) => item.sticky)
    expect(sticky?.readAt).toBeNull()
    expect(sticky?.title).toBe('Theme is in review')
    expect(body.unreadCount).toBe(1)

    const stickyOnly = await app.inject({
      method: 'GET',
      url: '/api/me/notifications?stickyOnly=true',
      headers: { cookie },
    })
    const stickyBody = stickyOnly.json() as { notifications: Array<{ sticky: boolean }> }
    expect(stickyBody.notifications).toHaveLength(1)
    expect(stickyBody.notifications[0]!.sticky).toBe(true)
  })
})
