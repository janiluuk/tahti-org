// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { cleanupUsersByEmailPrefix, createTestArtist } from '../../test/helpers.js'

const PREFIX = 'channels-list-'

describe('Public channel directory and platform stats', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let liveSlug: string
  let recentSlug: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const liveArtist = await createTestArtist(prisma, {
      email: `${PREFIX}live@example.com`,
      username: `${PREFIX}live`,
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98410,
    })
    liveSlug = liveArtist.username
    await prisma.channel.update({
      where: { id: liveArtist.channel!.id },
      data: { state: 'LIVE', goneLiveAt: new Date() },
    })

    const recentArtist = await createTestArtist(prisma, {
      email: `${PREFIX}recent@example.com`,
      username: `${PREFIX}recent`,
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98411,
    })
    recentSlug = recentArtist.username
    await prisma.channel.update({
      where: { id: recentArtist.channel!.id },
      data: { state: 'OFFLINE', goneLiveAt: new Date(Date.now() - 3600_000) },
    })

    await prisma.broadcast.create({
      data: {
        channelId: liveArtist.channel!.id,
        startedAt: new Date(),
        source: 'ICECAST',
      },
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('GET /api/v1/channels returns live and recent cards', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/channels' })
    expect(res.statusCode).toBe(200)

    const body = res.json() as {
      live: Array<{ slug: string; state: string }>
      recent: Array<{ slug: string; state: string }>
    }
    expect(body.live.some((c) => c.slug === liveSlug && c.state === 'LIVE')).toBe(true)
    expect(body.recent.some((c) => c.slug === recentSlug && c.state === 'OFFLINE')).toBe(true)
    expect(body.live[0].slug).toBeTruthy()
    expect(body.live[0].user?.displayName).toBeTruthy()
  })

  it('GET /api/v1/stats returns platform counters', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/stats' })
    expect(res.statusCode).toBe(200)

    const body = res.json() as {
      activeArtists: number
      broadcastsThisMonth: number
      totalHours: number
      totalStorageBytes: number
    }
    expect(body.activeArtists).toBeGreaterThanOrEqual(1)
    expect(body.broadcastsThisMonth).toBeGreaterThanOrEqual(1)
    expect(typeof body.totalHours).toBe('number')
    expect(typeof body.totalStorageBytes).toBe('number')
  })
})
