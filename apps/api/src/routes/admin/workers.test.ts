// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// getRedisClient() (apps/api/src/lib/redis.ts) returns null in NODE_ENV=test,
// same as apps/admin/logs.test.ts does for its own dependency (Loki) — these
// tests exercise the auth gate and the documented response shape when the
// backing store is unavailable, not real Redis-backed job history.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { laneCoverage } from './workers.js'
import { prisma } from '@tahti/db'
import {
  createTestArtist,
  sessionCookieFor,
  cleanupUsersByEmailPrefix,
} from '../../test/helpers.js'

const PREFIX = 'admin-workers-test-'

describe('GET /api/admin/workers', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: 'admin-workers-test-board',
      isBoard: true,
      isMember: true,
      memberNumber: 98320,
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
      username: 'admin-workers-test-member',
      isMember: true,
      memberNumber: 98321,
    })
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/workers',
      headers: { cookie: await sessionCookieFor(prisma, member.id) },
    })
    expect(res.statusCode).toBe(403)
    await prisma.user.delete({ where: { id: member.id } })
  })

  it('returns the documented shape', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/workers',
      headers: { cookie: boardCookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as {
      workers: unknown[]
      laneCoverage: { lane: string; onlineWorkers: number }[]
    }
    expect(Array.isArray(body.workers)).toBe(true)
    expect(body.laneCoverage.map((row) => row.lane)).toContain('transcode')
  })

  it('404s for an unregistered worker name', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/workers/does-not-exist',
      headers: { cookie: boardCookie },
    })
    expect(res.statusCode).toBe(404)
  })
})

describe('laneCoverage', () => {
  it('counts online workers per lane, with an unfiltered worker covering every lane', () => {
    const rows = laneCoverage([
      { lanes: ['media', 'light', 'dist'], status: 'online' },
      { lanes: ['transcode'], status: 'offline' },
      { lanes: ['all'], status: 'online' },
    ])
    const byLane = Object.fromEntries(rows.map((row) => [row.lane, row.onlineWorkers]))
    expect(byLane).toEqual({ transcode: 1, media: 2, dist: 2, light: 2, 'edge-log': 1 })
  })

  it('reports zero for a lane whose only worker is offline', () => {
    const rows = laneCoverage([{ lanes: ['transcode'], status: 'offline' }])
    expect(rows.find((row) => row.lane === 'transcode')?.onlineWorkers).toBe(0)
  })
})
