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

const PREFIX = 'admin-content-stats-'

type ContentStats = {
  counts: { tracks: number; shows: number; uploads: number; listens: number }
  latestContent: Array<{ id: string; title: string; type: string; artistName: string | null }>
  latestBroadcasts: Array<{
    id: string
    title: string
    artistName: string | null
    durationSec: number | null
    soundId: string | null
  }>
}

describe('GET /api/admin/stats/content', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string
  let memberCookie: string
  let channelId: string

  const stats = async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/stats/content',
      headers: { cookie: boardCookie },
    })
    expect(res.statusCode).toBe(200)
    return res.json() as ContentStats
  }

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: 'admin-content-stats-board',
      displayName: 'Board Artist',
      isBoard: true,
      isMember: true,
    })
    channelId = board.channel!.id
    boardCookie = await sessionCookieFor(prisma, board.id)
    const member = await createTestArtist(prisma, {
      email: `${PREFIX}member@example.com`,
      username: 'admin-content-stats-member',
    })
    memberCookie = await sessionCookieFor(prisma, member.id)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('is board-only', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/stats/content',
      headers: { cookie: memberCookie },
    })
    expect(res.statusCode).toBe(403)
  })

  it('counts tracks, uploads, shows and listens and lists the newest', async () => {
    const before = await stats()
    const track = await prisma.sound.create({
      data: { channelId, title: `${PREFIX}track`, contentType: 'TRACK', status: 'READY' },
    })
    await prisma.sound.create({
      data: { channelId, title: `${PREFIX}set`, contentType: 'DJ_SET', status: 'READY' },
    })
    await prisma.liveShowSeries.create({ data: { channelId, name: `${PREFIX}show` } })
    await prisma.listenEvent.create({
      data: { soundId: track.id, dedupeKey: `${PREFIX}listener`, dayBucket: '2026-09-30' },
    })

    const after = await stats()
    expect(after.counts.tracks - before.counts.tracks).toBe(1)
    expect(after.counts.uploads - before.counts.uploads).toBe(2)
    expect(after.counts.shows - before.counts.shows).toBe(1)
    expect(after.counts.listens - before.counts.listens).toBe(1)
    const newest = after.latestContent.find((item) => item.id === track.id)
    expect(newest).toMatchObject({ type: 'TRACK', artistName: 'Board Artist' })
  })

  it('lists finished public broadcasts with their length', async () => {
    const startedAt = new Date(Date.now() - 3600 * 1000)
    const ended = await prisma.broadcast.create({
      data: {
        channelId,
        source: 'RTMP',
        startedAt,
        wentLiveAt: startedAt,
        endedAt: new Date(startedAt.getTime() + 1800 * 1000),
      },
    })
    const neverLive = await prisma.broadcast.create({
      data: {
        channelId,
        source: 'RTMP',
        startedAt,
        endedAt: new Date(startedAt.getTime() + 60 * 1000),
      },
    })
    const { latestBroadcasts } = await stats()
    expect(latestBroadcasts.find((item) => item.id === ended.id)).toMatchObject({
      title: 'admin-content-stats-board',
      artistName: 'Board Artist',
      durationSec: 1800,
      soundId: null,
    })
    expect(latestBroadcasts.some((item) => item.id === neverLive.id)).toBe(false)
  })
})
