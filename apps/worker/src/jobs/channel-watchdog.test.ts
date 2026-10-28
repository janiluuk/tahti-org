// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Job } from 'bullmq'

vi.mock('../lib/orchestrator.js', () => ({
  restartChannelLiquidsoap: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../lib/hls-segment-age.js', () => ({
  hlsSegmentAgeSecFromFs: vi.fn().mockResolvedValue(null),
  hlsSegmentAgeSecFromMinio: vi.fn().mockResolvedValue(null),
}))

const restartTimestamps: number[] = []
vi.mock('redis', () => ({
  createClient: () => ({
    connect: async () => undefined,
    quit: async () => undefined,
    zAdd: async () => {
      restartTimestamps.push(Date.now())
    },
    zRemRangeByScore: async () => undefined,
    expire: async () => undefined,
    zCard: async () => restartTimestamps.length,
  }),
}))

import { processChannelWatchdogJob } from './channel-watchdog.js'
import { restartChannelLiquidsoap } from '../lib/orchestrator.js'
import { hlsSegmentAgeSecFromMinio } from '../lib/hls-segment-age.js'

const mockFindMany = vi.fn()

function fakePrisma() {
  return { channel: { findMany: mockFindMany } } as never
}

function liveChannel(slug: string, opts: { startedAgoMs: number; rotation?: boolean }) {
  return {
    id: `ch-${slug}`,
    slug,
    broadcasts: [{ id: `b-${slug}`, startedAt: new Date(Date.now() - opts.startedAgoMs) }],
    curatedRotationItems: opts.rotation ? [{ id: 'item-1' }] : [],
  }
}

describe('processChannelWatchdogJob', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    restartTimestamps.length = 0
    vi.mocked(hlsSegmentAgeSecFromMinio).mockResolvedValue(null)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  it('restarts a long-running LIVE channel whose HLS segments are missing entirely', async () => {
    mockFindMany.mockResolvedValue([
      liveChannel('tahti-selects', { startedAgoMs: 3 * 24 * 3600_000, rotation: true }),
    ])

    const result = await processChannelWatchdogJob(fakePrisma(), {} as Job)

    expect(result).toEqual({ checked: 1, restarted: 1, skipped: 0 })
    expect(restartChannelLiquidsoap).toHaveBeenCalledWith(
      'ch-tahti-selects',
      'tahti-selects',
      'b-tahti-selects',
      'rotation',
    )
  })

  it('gives a just-started broadcast time to write its first segment', async () => {
    mockFindMany.mockResolvedValue([liveChannel('artist-a', { startedAgoMs: 10_000 })])

    const result = await processChannelWatchdogJob(fakePrisma(), {} as Job)

    expect(result).toEqual({ checked: 1, restarted: 0, skipped: 1 })
    expect(restartChannelLiquidsoap).not.toHaveBeenCalled()
  })

  it('leaves a channel with fresh segments alone', async () => {
    vi.mocked(hlsSegmentAgeSecFromMinio).mockResolvedValue(3)
    mockFindMany.mockResolvedValue([liveChannel('tahti-radio', { startedAgoMs: 3600_000 })])

    const result = await processChannelWatchdogJob(fakePrisma(), {} as Job)

    expect(result).toEqual({ checked: 1, restarted: 0, skipped: 0 })
    expect(restartChannelLiquidsoap).not.toHaveBeenCalled()
  })

  it('restarts a channel with stale segments using the channel template', async () => {
    vi.mocked(hlsSegmentAgeSecFromMinio).mockResolvedValue(300)
    mockFindMany.mockResolvedValue([liveChannel('tahti-radio', { startedAgoMs: 3600_000 })])

    await processChannelWatchdogJob(fakePrisma(), {} as Job)

    expect(restartChannelLiquidsoap).toHaveBeenCalledWith(
      'ch-tahti-radio',
      'tahti-radio',
      'b-tahti-radio',
      'channel',
    )
  })

  it('respects the restart cap for missing segments too', async () => {
    restartTimestamps.push(1, 2)
    mockFindMany.mockResolvedValue([liveChannel('tahti-radio', { startedAgoMs: 3600_000 })])

    const result = await processChannelWatchdogJob(fakePrisma(), {} as Job)

    expect(result).toEqual({ checked: 1, restarted: 0, skipped: 1 })
    expect(restartChannelLiquidsoap).not.toHaveBeenCalled()
  })
})
