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
})
