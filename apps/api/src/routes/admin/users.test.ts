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

const PREFIX = 'admin-users-'

describe('M21-B — admin users API', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string
  let targetId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: 'admin-users-board',
    })
    await prisma.user.update({ where: { id: board.id }, data: { isBoard: true, isMember: true } })
    boardCookie = await sessionCookieFor(prisma, board.id)

    const target = await createTestArtist(prisma, {
      email: `${PREFIX}target@example.com`,
      username: 'admin-users-target',
    })
    targetId = target.id
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('GET /api/admin/users lists users', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/users?search=admin-users-target',
      headers: { cookie: boardCookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { users: Array<{ username: string }> }
    expect(body.users.some((u) => u.username === 'admin-users-target')).toBe(true)
  })

  it('POST suspend and unsuspend', async () => {
    const suspend = await app.inject({
      method: 'POST',
      url: `/api/admin/users/${targetId}/suspend`,
      headers: { cookie: boardCookie },
      payload: { reason: 'test suspension' },
    })
    expect(suspend.statusCode).toBe(200)
    expect(suspend.json().suspendedAt).toBeTruthy()

    const unsuspend = await app.inject({
      method: 'POST',
      url: `/api/admin/users/${targetId}/unsuspend`,
      headers: { cookie: boardCookie },
    })
    expect(unsuspend.statusCode).toBe(200)
    expect(unsuspend.json().suspendedAt).toBeNull()
  })
})
