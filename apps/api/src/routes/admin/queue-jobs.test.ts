// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  createTestArtist,
  sessionCookieFor,
  cleanupUsersByEmailPrefix,
} from '../../test/helpers.js'

const PREFIX = 'admin-queue-jobs-test-'

describe('GET /api/admin/queues/media/jobs', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: 'admin-queue-jobs-board',
      isBoard: true,
      isMember: true,
      memberNumber: 98420,
    })
    boardCookie = await sessionCookieFor(prisma, board.id)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('requires board role', async () => {
    const member = await createTestArtist(prisma, {
      email: `${PREFIX}member@example.com`,
      username: 'admin-queue-jobs-member',
      isMember: true,
      memberNumber: 98421,
    })
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/queues/media/jobs',
      headers: { cookie: await sessionCookieFor(prisma, member.id) },
    })
    expect(res.statusCode).toBe(403)
    await prisma.user.delete({ where: { id: member.id } })
  })

  it('returns the documented list shape', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/queues/media/jobs?state=waiting&limit=10',
      headers: { cookie: boardCookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as {
      state: string
      total: number
      page: number
      limit: number
      jobs: unknown[]
    }
    expect(body.state).toBe('waiting')
    expect(body.page).toBe(0)
    expect(body.limit).toBe(10)
    expect(typeof body.total).toBe('number')
    expect(Array.isArray(body.jobs)).toBe(true)
  })

  it('rejects an unknown state', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/queues/media/jobs?state=nope',
      headers: { cookie: boardCookie },
    })
    expect(res.statusCode).toBe(400)
  })
})
