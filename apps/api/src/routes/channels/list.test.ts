// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { cleanupUsersByEmailPrefix, createTestArtist } from '../../test/helpers.js'

const PREFIX = 'channel-list-test-'

describe('GET /api/v1/channels — live / replaying / recent tiers', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let liveSlug: string
  let replayingSlug: string
  let recentSlug: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const liveArtist = await createTestArtist(prisma, {
      email: `${PREFIX}live@example.com`,
      username: `${PREFIX}live`,
      tier: 'ARTIST',
    })
    liveSlug = liveArtist.channel!.slug
    await prisma.channel.update({
      where: { id: liveArtist.channel!.id },
      data: { state: 'LIVE', goneLiveAt: new Date() },
    })

    // Not live, but airing its own 24/7 archive rotation right now — REPLAY tier.
    const replayingArtist = await createTestArtist(prisma, {
      email: `${PREFIX}replaying@example.com`,
      username: `${PREFIX}replaying`,
      tier: 'ARTIST',
    })
    replayingSlug = replayingArtist.channel!.slug
    await prisma.channel.update({
      where: { id: replayingArtist.channel!.id },
      data: { state: 'OFFLINE', goneLiveAt: new Date(), fallbackEnabled: true },
    })

    // Not live, no rotation configured — was live before but plays nothing now.
    const recentArtist = await createTestArtist(prisma, {
      email: `${PREFIX}recent@example.com`,
      username: `${PREFIX}recent`,
      tier: 'ARTIST',
    })
    recentSlug = recentArtist.channel!.slug
    await prisma.channel.update({
      where: { id: recentArtist.channel!.id },
      data: { state: 'OFFLINE', goneLiveAt: new Date(), fallbackEnabled: false },
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('sorts channels into live, replaying, and recent tiers correctly', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/channels' })
    expect(res.statusCode).toBe(200)
    const body = res.json() as {
      live: Array<{ slug: string; fallbackEnabled: boolean }>
      replaying: Array<{ slug: string; fallbackEnabled: boolean }>
      recent: Array<{ slug: string; fallbackEnabled: boolean }>
    }

    expect(body.live.some((c) => c.slug === liveSlug)).toBe(true)
    expect(body.replaying.some((c) => c.slug === liveSlug)).toBe(false)
    expect(body.recent.some((c) => c.slug === liveSlug)).toBe(false)

    expect(body.replaying.some((c) => c.slug === replayingSlug)).toBe(true)
    expect(body.live.some((c) => c.slug === replayingSlug)).toBe(false)
    expect(body.recent.some((c) => c.slug === replayingSlug)).toBe(false)
    expect(body.replaying.find((c) => c.slug === replayingSlug)?.fallbackEnabled).toBe(true)

    expect(body.recent.some((c) => c.slug === recentSlug)).toBe(true)
    expect(body.live.some((c) => c.slug === recentSlug)).toBe(false)
    expect(body.replaying.some((c) => c.slug === recentSlug)).toBe(false)
  })
})
