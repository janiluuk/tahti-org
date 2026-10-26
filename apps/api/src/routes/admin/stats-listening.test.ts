// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@tahti/db'
import { buildApp } from '../../server.js'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'admin-listening-test-'

describe('GET /api/admin/stats/listening', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string
  let memberCookie: string
  let channelId: string
  let listenerId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: `${PREFIX}board`,
    })
    await prisma.user.update({ where: { id: board.id }, data: { isBoard: true, isMember: true } })
    boardCookie = await sessionCookieFor(prisma, board.id)
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: `${PREFIX}artist`,
      displayName: 'Busiest Channel',
    })
    channelId = artist.channel!.id
    memberCookie = await sessionCookieFor(prisma, artist.id)
    const listener = await createTestArtist(prisma, {
      email: `${PREFIX}listener@example.com`,
      username: `${PREFIX}listener`,
    })
    listenerId = listener.id
  })

  afterAll(async () => {
    await prisma.listenSession.deleteMany({ where: { channelId } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  const get = (cookie: string) =>
    app.inject({ method: 'GET', url: '/api/admin/stats/listening?range=7', headers: { cookie } })

  it('adds up platform listening, leaving bots out, and ranks channels by minutes', async () => {
    const before = (await get(boardCookie)).json()
    const now = Date.now()
    const session = (minutes: number, extra: object = {}) => ({
      channelId,
      byFingerprint: `${PREFIX}${Math.random()}`,
      byIpHash: 'x',
      source: 'TAHTI_RADIO' as const,
      startedAt: new Date(now - minutes * 60_000),
      lastSeenAt: new Date(now),
      ...extra,
    })
    await prisma.listenSession.createMany({
      data: [
        session(5_000, { byUserId: listenerId }),
        session(1_000, { byUserId: listenerId }),
        session(500, { isBot: true }),
      ],
    })

    const res = await get(boardCookie)
    expect(res.statusCode).toBe(200)
    const after = res.json()
    expect(after.listens - before.listens).toBe(2)
    expect(after.minutes - before.minutes).toBe(6_000)
    expect(after.signedInListeners - before.signedInListeners).toBe(1)
    expect(after.topChannels[0]).toMatchObject({
      name: 'Busiest Channel',
      minutes: 6_000,
      listens: 2,
    })
    expect(after.surfaces.map((s: { name: string }) => s.name)).toContain('TAHTI_RADIO')
  })

  it('is for the board only', async () => {
    expect((await get(memberCookie)).statusCode).toBe(403)
  })
})
