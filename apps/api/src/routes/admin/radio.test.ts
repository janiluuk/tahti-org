// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'admin-radio-'

describe('Admin radio panel', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string
  let liveChannelId: string
  let optedOutChannelId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: `${PREFIX}board`,
      isBoard: true,
      isMember: true,
      memberNumber: 98430,
      tier: 'ARTIST',
    })
    boardCookie = await sessionCookieFor(prisma, board.id)

    const live = await createTestArtist(prisma, {
      email: `${PREFIX}live@example.com`,
      username: `${PREFIX}live`,
      isMember: true,
      memberNumber: 98431,
      tier: 'ARTIST',
    })
    liveChannelId = live.channel!.id
    await prisma.channel.update({
      where: { id: liveChannelId },
      data: { state: 'LIVE', metaStreamOptOut: false },
    })

    const opted = await createTestArtist(prisma, {
      email: `${PREFIX}optout@example.com`,
      username: `${PREFIX}optout`,
      isMember: true,
      memberNumber: 98432,
      tier: 'ARTIST',
    })
    optedOutChannelId = opted.channel!.id
    await prisma.channel.update({
      where: { id: optedOutChannelId },
      data: { metaStreamOptOut: true },
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
    vi.unstubAllGlobals()
  })

  it('rejects anonymous access', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/radio' })
    expect(res.statusCode).toBe(401)
  })

  it('returns aggregate radio status for board', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            live: true,
            channel: { slug: `${PREFIX}live`, displayName: 'Live DJ' },
          }),
          { status: 200 },
        ),
      ),
    )

    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/radio',
      headers: { cookie: boardCookie },
    })
    expect(res.statusCode).toBe(200)

    const body = res.json() as {
      nowPlaying: { live: boolean }
      eligible: Array<{ channelId: string }>
      optedOut: Array<{ channelId: string }>
      history: unknown[]
    }
    expect(body.nowPlaying.live).toBe(true)
    expect(body.eligible.some((c) => c.channelId === liveChannelId)).toBe(true)
    expect(body.optedOut.some((c) => c.channelId === optedOutChannelId)).toBe(true)
    expect(Array.isArray(body.history)).toBe(true)
  })

  it('opts out and back in for rotation', async () => {
    const optOut = await app.inject({
      method: 'POST',
      url: `/api/admin/radio/opt-out/${liveChannelId}`,
      headers: { cookie: boardCookie },
    })
    expect(optOut.statusCode).toBe(200)

    const channel = await prisma.channel.findUniqueOrThrow({ where: { id: liveChannelId } })
    expect(channel.metaStreamOptOut).toBe(true)

    const optIn = await app.inject({
      method: 'DELETE',
      url: `/api/admin/radio/opt-out/${liveChannelId}`,
      headers: { cookie: boardCookie },
    })
    expect(optIn.statusCode).toBe(200)

    const restored = await prisma.channel.findUniqueOrThrow({ where: { id: liveChannelId } })
    expect(restored.metaStreamOptOut).toBe(false)
  })

  it('reset-rotation clears lastFeaturedAt', async () => {
    await prisma.channel.update({
      where: { id: liveChannelId },
      data: { lastFeaturedAt: new Date(), metaStreamOptOut: false },
    })

    const res = await app.inject({
      method: 'POST',
      url: `/api/admin/radio/reset-rotation/${liveChannelId}`,
      headers: { cookie: boardCookie },
    })
    expect(res.statusCode).toBe(200)

    const channel = await prisma.channel.findUniqueOrThrow({ where: { id: liveChannelId } })
    expect(channel.lastFeaturedAt).toBeNull()
  })
})
