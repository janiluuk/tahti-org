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

const PREFIX = 'login-ban-sessions-'

describe('A sign-in ban ends the account’s current sessions', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string
  let userId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: `${PREFIX}board`,
      isBoard: true,
      isMember: true,
    })
    boardCookie = await sessionCookieFor(prisma, board.id)
    const user = await createTestArtist(prisma, {
      email: `${PREFIX}user@example.com`,
      username: `${PREFIX}user`,
    })
    userId = user.id
  })

  afterAll(async () => {
    await prisma.accountRestriction.deleteMany({ where: { userId } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  const restrict = (type: string) =>
    app.inject({
      method: 'POST',
      url: `/api/admin/users/${userId}/restrictions`,
      headers: { cookie: boardCookie },
      payload: { type, reason: 'Abuse' },
    })

  const me = (cookie: string) =>
    app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } })

  it('keeps sessions for an upload ban', async () => {
    const cookie = await sessionCookieFor(prisma, userId)
    expect((await restrict('UPLOAD')).statusCode).toBe(201)
    expect((await me(cookie)).json().id).toBe(userId)
  })

  it('signs the account out everywhere for a sign-in ban', async () => {
    const cookie = await sessionCookieFor(prisma, userId)
    expect((await me(cookie)).json().id).toBe(userId)
    expect((await restrict('LOGIN')).statusCode).toBe(201)
    expect(await prisma.session.count({ where: { userId } })).toBe(0)
    expect((await me(cookie)).statusCode).toBe(401)
  })
})
