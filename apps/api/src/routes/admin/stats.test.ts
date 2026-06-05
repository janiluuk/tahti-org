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

const PREFIX = 'admin-stats-'

describe('M21-A — admin stats API', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string
  let userCookie: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: 'admin-stats-board',
    })
    await prisma.user.update({ where: { id: board.id }, data: { isBoard: true, isMember: true } })
    boardCookie = await sessionCookieFor(prisma, board.id)

    const user = await createTestArtist(prisma, {
      email: `${PREFIX}user@example.com`,
      username: 'admin-stats-user',
    })
    userCookie = await sessionCookieFor(prisma, user.id)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('rejects non-board users', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/stats/members',
      headers: { cookie: userCookie },
    })
    expect(res.statusCode).toBe(403)
  })

  it('GET /api/admin/stats/members returns counts', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/stats/members',
      headers: { cookie: boardCookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { total: number; newThisMonth: number; lapsedThisMonth: number }
    expect(body.total).toBeGreaterThanOrEqual(1)
  })

  it('GET /api/admin/streams lists live channels', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/streams',
      headers: { cookie: boardCookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toHaveProperty('streams')
  })

  it('GET /api/admin/audit/recent returns array', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/audit/recent',
      headers: { cookie: boardCookie },
    })
    expect(res.statusCode).toBe(200)
    expect(Array.isArray(res.json())).toBe(true)
  })
})
