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

describe('admin media queue routes', () => {
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

  it('requires board role for the job list', async () => {
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

  it('reports paused state and accepts pause then resume', async () => {
    const before = await app.inject({
      method: 'GET',
      url: '/api/admin/queues/media/paused',
      headers: { cookie: boardCookie },
    })
    expect(before.statusCode).toBe(200)
    expect(typeof (before.json() as { paused: boolean }).paused).toBe('boolean')

    const paused = await app.inject({
      method: 'POST',
      url: '/api/admin/queues/media/pause',
      headers: { cookie: boardCookie },
    })
    expect(paused.statusCode).toBe(200)
    expect((paused.json() as { paused: boolean }).paused).toBe(true)

    const resumed = await app.inject({
      method: 'POST',
      url: '/api/admin/queues/media/resume',
      headers: { cookie: boardCookie },
    })
    expect(resumed.statusCode).toBe(200)
    expect((resumed.json() as { paused: boolean }).paused).toBe(false)
  })

  it('returns 404 when retrying a missing job', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/queues/media/jobs/no-such-job/retry',
      headers: { cookie: boardCookie },
    })
    expect(res.statusCode).toBe(404)
  })

  it('returns 404 when removing a missing job', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/admin/queues/media/jobs/no-such-job',
      headers: { cookie: boardCookie },
    })
    expect(res.statusCode).toBe(404)
  })

  it('lists stuck-pending sounds', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/queues/media/stuck-pending',
      headers: { cookie: boardCookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { total: number; sounds: unknown[] }
    expect(typeof body.total).toBe('number')
    expect(Array.isArray(body.sounds)).toBe(true)
  })

  it('rejects requeue without soundId or all', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/queues/media/stuck-pending/requeue',
      headers: { cookie: boardCookie, 'content-type': 'application/json' },
      payload: {},
    })
    expect(res.statusCode).toBe(400)
  })
})
