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

const PREFIX = 'acct-del-'

describe('M19 — account deletion execute', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string
  let targetId: string
  let targetEmail: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const orphanChannels = await prisma.channel.findMany({
      where: { slug: { startsWith: 'acct-del-' } },
      select: { id: true, userId: true },
    })
    if (orphanChannels.length > 0) {
      const orphanUserIds = orphanChannels.map((c) => c.userId)
      await prisma.supportTicket.deleteMany({ where: { artistId: { in: orphanUserIds } } })
      for (const ch of orphanChannels) {
        await prisma.download.deleteMany({ where: { channelId: ch.id } })
      }
      await prisma.channel.deleteMany({ where: { slug: { startsWith: 'acct-del-' } } })
      await prisma.user.deleteMany({ where: { id: { in: orphanUserIds } } })
    }

    const stale = await prisma.user.findMany({
      where: { username: { startsWith: 'acct-del-' } },
      select: { id: true, channel: { select: { id: true } } },
    })
    if (stale.length > 0) {
      const staleIds = stale.map((u) => u.id)
      await prisma.supportTicket.deleteMany({ where: { artistId: { in: staleIds } } })
      for (const u of stale) {
        if (u.channel) await prisma.download.deleteMany({ where: { channelId: u.channel.id } })
      }
      await prisma.user.deleteMany({ where: { id: { in: staleIds } } })
    }

    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: 'acct-del-board',
    })
    await prisma.user.update({ where: { id: board.id }, data: { isBoard: true, isMember: true } })
    boardCookie = await sessionCookieFor(prisma, board.id)

    const target = await createTestArtist(prisma, {
      email: `${PREFIX}target@example.com`,
      username: 'acct-del-target',
    })
    targetId = target.id
    targetEmail = target.email

    await prisma.supportTicket.create({
      data: {
        artistId: targetId,
        subject: 'Account deletion request',
        message: 'Please delete',
        category: 'OTHER',
      },
    })
  })

  afterAll(async () => {
    await prisma.supportTicket.deleteMany({})
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('POST delete-account requires board role', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/admin/users/${targetId}/delete-account`,
      headers: { cookie: await sessionCookieFor(prisma, targetId) },
    })
    expect(res.statusCode).toBe(403)
  })

  it('POST delete-account anonymizes user', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/admin/users/${targetId}/delete-account`,
      headers: { cookie: boardCookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().fanSubscriptionsCanceled).toBe(0)

    const user = await prisma.user.findUnique({ where: { id: targetId } })
    expect(user?.deletedAt).not.toBeNull()
    expect(user?.email).not.toBe(targetEmail)
    expect(user?.displayName).toBe('Deleted user')

    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: targetEmail, password: 'testpassword' },
    })
    expect(login.statusCode).toBe(401)
  })
})
