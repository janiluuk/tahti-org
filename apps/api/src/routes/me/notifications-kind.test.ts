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

const PREFIX = 'notif-kind-'

describe('GET /api/me/notifications?kind=', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const user = await createTestArtist(prisma, {
      email: `${PREFIX}user@example.com`,
      username: 'notif-kind-user',
    })
    cookie = await sessionCookieFor(prisma, user.id)
    await prisma.notification.createMany({
      data: [
        { userId: user.id, type: 'NEW_FOLLOWER', title: 'follower' },
        { userId: user.id, type: 'NEW_TRACK', title: 'track' },
        { userId: user.id, type: 'PAYOUT_SENT', title: 'payout' },
        { userId: user.id, type: 'MOTION_OPENED', title: 'motion' },
        { userId: user.id, type: 'SUPPORT_REPLY', title: 'support' },
      ],
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  const titles = async (kind?: string) => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/me/notifications${kind ? `?kind=${kind}` : ''}`,
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { notifications: { title: string }[]; unreadCount: number }
    return { titles: body.notifications.map((n) => n.title).sort(), unread: body.unreadCount }
  }

  it('narrows the list to one group and keeps the full unread count', async () => {
    expect(await titles('social')).toEqual({ titles: ['follower'], unread: 5 })
    expect((await titles('music')).titles).toEqual(['track'])
    expect((await titles('money')).titles).toEqual(['payout'])
    expect((await titles('governance')).titles).toEqual(['motion'])
    expect((await titles('other')).titles).toEqual(['support'])
    expect((await titles()).titles).toHaveLength(5)
  })

  it('rejects an unknown kind', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/notifications?kind=everything',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(400)
  })
})
