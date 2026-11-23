// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '@tahti/db'
import { buildApp } from '../../server.js'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'admin-stats-chat-'
const DAY_MS = 86_400_000

/** The per-message bucketing the timeseries used before it moved to SQL. */
async function expectedSeries(days: number) {
  const since = new Date()
  since.setUTCHours(0, 0, 0, 0)
  since.setUTCDate(since.getUTCDate() - (days - 1))
  const messages = await prisma.chatMessage.findMany({
    where: { createdAt: { gte: since } },
    select: { createdAt: true },
  })
  const countByDate = new Map<string, number>()
  for (const { createdAt } of messages) {
    const key = createdAt.toISOString().slice(0, 10)
    countByDate.set(key, (countByDate.get(key) ?? 0) + 1)
  }
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(since)
    d.setUTCDate(d.getUTCDate() + i)
    const key = d.toISOString().slice(0, 10)
    return { date: key, count: countByDate.get(key) ?? 0 }
  })
}

describe('admin chat stats', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string

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

    const todayStart = new Date()
    todayStart.setUTCHours(0, 0, 0, 0)
    const at = [
      new Date(todayStart.getTime() + 500),
      new Date(todayStart.getTime() - 100),
      new Date(todayStart.getTime() - 2 * DAY_MS + 3_600_000),
      new Date(todayStart.getTime() - 2 * DAY_MS + 3_600_000),
      new Date(todayStart.getTime() - 40 * DAY_MS),
    ]
    await prisma.chatMessage.createMany({
      data: at.map((createdAt, n) => ({
        channelId: board.channel!.id,
        handle: `${PREFIX}${n}`,
        text: 'hello',
        createdAt,
      })),
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('counts daily messages in SQL exactly as the per-message bucketing did', async () => {
    for (const days of [3, 30, 90]) {
      const res = await app.inject({
        method: 'GET',
        url: `/api/admin/stats/chat-timeseries?days=${days}`,
        headers: { cookie: boardCookie },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json() as { days: number; series: Array<{ date: string; count: number }> }
      expect(body.days).toBe(days)
      expect(body.series).toEqual(await expectedSeries(days))
    }
  })

  it('reports messages from the last 24 hours', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/stats/chat',
      headers: { cookie: boardCookie },
    })
    expect(res.statusCode).toBe(200)
    const expected = await prisma.chatMessage.count({
      where: { createdAt: { gte: new Date(Date.now() - DAY_MS) } },
    })
    expect(res.json()).toEqual({ last24h: expected })
    expect(expected).toBeGreaterThanOrEqual(2)
  })
})
