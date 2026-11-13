// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it, vi } from 'vitest'
import { buildPublicChannelMetrics } from './artist-stats.js'

function fakePrisma(opts: {
  channelId?: string | null
  releaseIds?: string[]
  downloadsToday?: number
  downloadsYesterday?: number
  clicksToday?: number
  clicksYesterday?: number
}) {
  const channelId = opts.channelId ?? 'ch1'
  const releaseIds = opts.releaseIds ?? ['r1']
  return {
    channel: {
      findUnique: vi.fn().mockResolvedValue(channelId ? { id: channelId } : null),
    },
    release: {
      findMany: vi.fn().mockResolvedValue(releaseIds.map((id) => ({ id }))),
    },
    download: {
      count: vi.fn().mockImplementation(({ where }: { where: { createdAt?: { gte: Date } } }) => {
        const gte = where.createdAt?.gte
        if (!gte) return Promise.resolve(0)
        const today = new Date()
        const todayStart = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
        if (gte.getTime() >= todayStart) return Promise.resolve(opts.downloadsToday ?? 0)
        return Promise.resolve(opts.downloadsYesterday ?? 0)
      }),
    },
    smartLinkClick: {
      count: vi.fn().mockImplementation(({ where }: { where: { createdAt?: { gte: Date } } }) => {
        const gte = where.createdAt?.gte
        if (!gte) return Promise.resolve(0)
        const today = new Date()
        const todayStart = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
        if (gte.getTime() >= todayStart) return Promise.resolve(opts.clicksToday ?? 0)
        return Promise.resolve(opts.clicksYesterday ?? 0)
      }),
    },
  }
}

describe('buildPublicChannelMetrics', () => {
  it('omits every key when all toggles are off', async () => {
    const prisma = fakePrisma({})
    const result = await buildPublicChannelMetrics(
      prisma as never,
      'u1',
      {
        showPlaysTotal: false,
        showPlaysToday: false,
        showPlaysYesterday: false,
        showDownloads: false,
      },
      { plays: 99, downloads: 12 },
    )
    expect(result.metrics).toEqual({})
    expect(result.totalsPlays).toBeUndefined()
    expect(result.totalsDownloads).toBeUndefined()
    expect(prisma.download.count).not.toHaveBeenCalled()
  })

  it('includes only the enabled metrics', async () => {
    const prisma = fakePrisma({
      downloadsToday: 2,
      clicksToday: 3,
      downloadsYesterday: 1,
      clicksYesterday: 1,
    })
    const result = await buildPublicChannelMetrics(
      prisma as never,
      'u1',
      {
        showPlaysTotal: true,
        showPlaysToday: true,
        showPlaysYesterday: true,
        showDownloads: true,
      },
      { plays: 40, downloads: 7 },
    )
    expect(result.metrics).toEqual({
      playsToday: 5,
      playsYesterday: 2,
      playsTotal: 40,
      downloads: 7,
    })
    expect(result.totalsPlays).toBe(40)
    expect(result.totalsDownloads).toBe(7)
  })
})
