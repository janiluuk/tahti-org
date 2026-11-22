// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { WORKER_CRON_JOBS, cronTaskNames } from '@tahti/shared'
import { config } from '../../config.js'
import { cachedAdminStat, clearAdminStatsCache } from '../../lib/admin-stats-cache.js'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'admin-stats-cache-'
const jobName = WORKER_CRON_JOBS.flatMap(cronTaskNames)[0]!

describe('admin dashboard panels reuse one result for a short while', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string
  const createdRunIds: bigint[] = []
  const ttlBefore = config.adminStatsCacheSec

  async function addRun(startedAt: Date) {
    const run = await prisma.cronRun.create({
      data: { jobName, startedAt, finishedAt: startedAt, outcome: 'SUCCESS' },
    })
    createdRunIds.push(run.id)
    return run.id.toString()
  }

  async function lastRunId() {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/stats/cron-runs',
      headers: { cookie: boardCookie },
    })
    expect(res.statusCode).toBe(200)
    const row = (res.json() as Array<{ jobName: string; lastRun: { id: string } | null }>).find(
      (r) => r.jobName === jobName,
    )
    return row?.lastRun?.id
  }

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
  })

  afterEach(() => {
    config.adminStatsCacheSec = ttlBefore
    clearAdminStatsCache()
  })

  afterAll(async () => {
    await prisma.cronRun.deleteMany({ where: { id: { in: createdRunIds } } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('computes once within the TTL, again after it, and every time when it is 0', async () => {
    let clock = 1_000_000
    const now = () => clock
    const compute = vi.fn(async () => ({ at: clock }))

    config.adminStatsCacheSec = 30
    const [first, concurrent] = await Promise.all([
      cachedAdminStat('unit-test', compute, now),
      cachedAdminStat('unit-test', compute, now),
    ])
    clock += 29_000
    const cached = await cachedAdminStat('unit-test', compute, now)
    expect(concurrent).toBe(first)
    expect(cached).toBe(first)
    expect(compute).toHaveBeenCalledTimes(1)

    clock += 2_000
    await cachedAdminStat('unit-test', compute, now)
    expect(compute).toHaveBeenCalledTimes(2)

    config.adminStatsCacheSec = 0
    await cachedAdminStat('unit-test', compute, now)
    await cachedAdminStat('unit-test', compute, now)
    expect(compute).toHaveBeenCalledTimes(4)
  })

  it('reports the newest run of each job', async () => {
    await addRun(new Date(Date.now() + 60_000))
    const newest = await addRun(new Date(Date.now() + 120_000))
    expect(await lastRunId()).toBe(newest)
  })

  it('serves the cached cron panel until the entry expires', async () => {
    config.adminStatsCacheSec = 30
    const cachedId = await lastRunId()
    const newer = await addRun(new Date(Date.now() + 180_000))

    expect(await lastRunId()).toBe(cachedId)

    clearAdminStatsCache()
    expect(await lastRunId()).toBe(newer)
  })
})
