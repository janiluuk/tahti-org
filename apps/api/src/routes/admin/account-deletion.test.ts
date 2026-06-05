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
