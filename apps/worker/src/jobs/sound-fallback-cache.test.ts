// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Job } from 'bullmq'

vi.mock('../lib/sound-fallback-cache.js', () => ({
  syncChannelSoundFallbackCache: vi.fn().mockResolvedValue({
    downloaded: 1,
    skipped: 0,
    pruned: 0,
  }),
}))

import {
  processSoundFallbackCacheSyncJob,
  processWarmSoundFallbackCacheJob,
} from './sound-fallback-cache.js'
import { syncChannelSoundFallbackCache } from '../lib/sound-fallback-cache.js'

const mockFindMany = vi.fn()

describe('processWarmSoundFallbackCacheJob', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.SOUND_CACHE_ROOT
  })

  it('no-ops when SOUND_CACHE_ROOT is unset', async () => {
    const result = await processWarmSoundFallbackCacheJob(
      {} as never,
      {
        data: { channelId: 'ch-1' },
      } as Job,
    )

    expect(result).toEqual({ channelId: 'ch-1', downloaded: 0, skipped: 0, pruned: 0 })
    expect(syncChannelSoundFallbackCache).not.toHaveBeenCalled()
  })

  it('syncs the requested channel when cache root is configured', async () => {
    process.env.SOUND_CACHE_ROOT = '/sound-cache'

    const result = await processWarmSoundFallbackCacheJob(
      {} as never,
      {
        data: { channelId: 'ch-1' },
      } as Job,
    )

    expect(syncChannelSoundFallbackCache).toHaveBeenCalledWith({}, 'ch-1', '/sound-cache')
    expect(result).toEqual({
      channelId: 'ch-1',
      downloaded: 1,
      skipped: 0,
      pruned: 0,
    })
  })
})

describe('processSoundFallbackCacheSyncJob', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.SOUND_CACHE_ROOT
  })

  it('no-ops when SOUND_CACHE_ROOT is unset', async () => {
    const summary = await processSoundFallbackCacheSyncJob({} as never, {} as Job)
    expect(summary).toEqual({ channels: 0, downloaded: 0, skipped: 0, pruned: 0 })
    expect(mockFindMany).not.toHaveBeenCalled()
  })

  it('syncs every channel with ready sound audio', async () => {
    process.env.SOUND_CACHE_ROOT = '/sound-cache'
    mockFindMany.mockResolvedValue([{ id: 'ch-1' }, { id: 'ch-2' }])

    const summary = await processSoundFallbackCacheSyncJob(
      { channel: { findMany: mockFindMany } } as never,
      {} as Job,
    )

    expect(syncChannelSoundFallbackCache).toHaveBeenCalledTimes(2)
    expect(summary).toEqual({ channels: 2, downloaded: 2, skipped: 0, pruned: 0 })
  })
})
