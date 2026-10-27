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

const PREFIX = 'notif-counts-'

describe('GET /api/me/notifications/unread-counts', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const user = await createTestArtist(prisma, {
      email: `${PREFIX}user@example.com`,
      username: 'notif-counts-user',
    })
    cookie = await sessionCookieFor(prisma, user.id)
    const read = new Date()
    await prisma.notification.createMany({
      data: [
        { userId: user.id, type: 'NEW_FOLLOWER', title: 'a' },
        { userId: user.id, type: 'NEW_LIKE', title: 'b' },
        { userId: user.id, type: 'NEW_LIKE', title: 'read', readAt: read },
        { userId: user.id, type: 'PAYOUT_SENT', title: 'c' },
        { userId: user.id, type: 'SUPPORT_REPLY', title: 'd' },
      ],
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('counts unread notifications per kind', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/notifications/unread-counts',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({
      total: 4,
      byKind: { social: 2, music: 0, money: 1, governance: 0, other: 1 },
    })
  })

  it('needs a signed-in account', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/me/notifications/unread-counts' })
    expect(res.statusCode).toBe(401)
  })
})
