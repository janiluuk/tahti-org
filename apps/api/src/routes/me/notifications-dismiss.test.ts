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

const PREFIX = 'notif-dismiss-'

describe('Removing notifications', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let userId: string
  let cookie: string
  let otherCookie: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const user = await createTestArtist(prisma, {
      email: `${PREFIX}user@example.com`,
      username: 'notif-dismiss-user',
    })
    userId = user.id
    cookie = await sessionCookieFor(prisma, user.id)
    const other = await createTestArtist(prisma, {
      email: `${PREFIX}other@example.com`,
      username: 'notif-dismiss-other',
    })
    otherCookie = await sessionCookieFor(prisma, other.id)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  const make = (data: { sticky?: boolean; readAt?: Date | null; title?: string }) =>
    prisma.notification.create({
      data: { userId, type: 'ADMIN_TEST', title: data.title ?? 'Hello', ...data },
    })

  it('removes one notification, only for its owner', async () => {
    const row = await make({})
    const foreign = await app.inject({
      method: 'DELETE',
      url: `/api/me/notifications/${row.id}`,
      headers: { cookie: otherCookie },
    })
    expect(foreign.statusCode).toBe(404)

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/me/notifications/${row.id}`,
      headers: { cookie },
    })
    expect(res.statusCode).toBe(204)
    expect(await prisma.notification.findUnique({ where: { id: row.id } })).toBeNull()
  })

  it('refuses to remove an unacknowledged sticky notice', async () => {
    const sticky = await make({ sticky: true })
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/me/notifications/${sticky.id}`,
      headers: { cookie },
    })
    expect(res.statusCode).toBe(409)

    await prisma.notification.update({ where: { id: sticky.id }, data: { readAt: new Date() } })
    const again = await app.inject({
      method: 'DELETE',
      url: `/api/me/notifications/${sticky.id}`,
      headers: { cookie },
    })
    expect(again.statusCode).toBe(204)
  })

  it('clears every read notification and keeps the unread ones', async () => {
    await prisma.notification.deleteMany({ where: { userId } })
    await make({ readAt: new Date(), title: 'old 1' })
    await make({ readAt: new Date(), title: 'old 2' })
    const unread = await make({ title: 'new' })

    const bad = await app.inject({
      method: 'DELETE',
      url: '/api/me/notifications',
      headers: { cookie },
    })
    expect(bad.statusCode).toBe(400)

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/me/notifications?read=true',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ removed: 2 })
    const left = await prisma.notification.findMany({ where: { userId } })
    expect(left.map((n) => n.id)).toEqual([unread.id])
  })
})
