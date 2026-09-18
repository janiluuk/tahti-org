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
const CRON_JOB_PREFIX = 'admin-stats-cron-history-test'

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
    await prisma.cronRun.deleteMany({ where: { jobName: { startsWith: CRON_JOB_PREFIX } } })
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

  it(
    'GET /api/admin/stats/mail returns hello/support counts (zeros when prometheus is down)',
    { timeout: 15000 },
    async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/stats/mail',
        headers: { cookie: boardCookie },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json() as {
        hello: { unseen: number; total: number }
        support: { unseen: number; total: number }
      }
      expect(body.hello.unseen).toBeGreaterThanOrEqual(0)
      expect(body.support.unseen).toBeGreaterThanOrEqual(0)
    },
  )

  it('GET /api/admin/stats/mail rejects non-board users', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/stats/mail',
      headers: { cookie: userCookie },
    })
    expect(res.statusCode).toBe(403)
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

  describe('GET /api/admin/stats/cron-runs/history', () => {
    const jobNameA = `${CRON_JOB_PREFIX}-a`
    const jobNameB = `${CRON_JOB_PREFIX}-b`

    beforeAll(async () => {
      await prisma.cronRun.createMany({
        data: [
          {
            jobName: jobNameA,
            startedAt: new Date('2026-01-01T00:00:00Z'),
            finishedAt: new Date('2026-01-01T00:00:05Z'),
            outcome: 'SUCCESS',
            resultJson: '{"ok":true}',
          },
          {
            jobName: jobNameA,
            startedAt: new Date('2026-01-02T00:00:00Z'),
            finishedAt: null,
            outcome: null,
            errorMessage: null,
          },
          {
            jobName: jobNameB,
            startedAt: new Date('2026-01-03T00:00:00Z'),
            finishedAt: new Date('2026-01-03T00:00:02Z'),
            outcome: 'ERROR',
            errorMessage: 'boom',
          },
        ],
      })
    })

    it('rejects non-board users', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/stats/cron-runs/history',
        headers: { cookie: userCookie },
      })
      expect(res.statusCode).toBe(403)
    })

    it('returns entries newest-first with computed durationMs', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/admin/stats/cron-runs/history?jobName=${jobNameA}`,
        headers: { cookie: boardCookie },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json() as {
        page: number
        limit: number
        total: number
        items: Array<{
          jobName: string
          outcome: string | null
          durationMs: number | null
          finishedAt: string | null
        }>
      }
      expect(body.total).toBe(2)
      expect(body.items).toHaveLength(2)
      // Newest startedAt (the still-running row) comes first.
      expect(body.items[0]?.finishedAt).toBeNull()
      expect(body.items[0]?.durationMs).toBeNull()
      expect(body.items[1]?.outcome).toBe('SUCCESS')
      expect(body.items[1]?.durationMs).toBe(5000)
    })

    it('filters by jobName', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/admin/stats/cron-runs/history?jobName=${jobNameB}`,
        headers: { cookie: boardCookie },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json() as { total: number; items: Array<{ jobName: string }> }
      expect(body.total).toBe(1)
      expect(body.items[0]?.jobName).toBe(jobNameB)
    })

    it('paginates with page/limit', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/admin/stats/cron-runs/history?jobName=${jobNameA}&page=2&limit=1`,
        headers: { cookie: boardCookie },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json() as {
        page: number
        limit: number
        total: number
        items: Array<{ outcome: string | null }>
      }
      expect(body.page).toBe(2)
      expect(body.limit).toBe(1)
      expect(body.total).toBe(2)
      expect(body.items).toHaveLength(1)
      expect(body.items[0]?.outcome).toBe('SUCCESS')
    })
  })
})
