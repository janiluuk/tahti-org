// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Job } from 'bullmq'

vi.mock('../lib/archive-fallback-cache.js', () => ({
  syncChannelArchiveFallbackCache: vi.fn().mockResolvedValue({
    downloaded: 1,
    skipped: 0,
    pruned: 0,
  }),
}))

import {
  processArchiveFallbackCacheSyncJob,
  processWarmArchiveFallbackCacheJob,
} from './archive-fallback-cache.js'
import { syncChannelArchiveFallbackCache } from '../lib/archive-fallback-cache.js'

const mockFindMany = vi.fn()

describe('processWarmArchiveFallbackCacheJob', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.ARCHIVE_CACHE_ROOT
  })

  it('no-ops when ARCHIVE_CACHE_ROOT is unset', async () => {
    const result = await processWarmArchiveFallbackCacheJob(
      {} as never,
      {
        data: { channelId: 'ch-1' },
      } as Job,
    )

    expect(result).toEqual({ channelId: 'ch-1', downloaded: 0, skipped: 0, pruned: 0 })
    expect(syncChannelArchiveFallbackCache).not.toHaveBeenCalled()
  })

  it('syncs the requested channel when cache root is configured', async () => {
    process.env.ARCHIVE_CACHE_ROOT = '/archive-cache'

    const result = await processWarmArchiveFallbackCacheJob(
      {} as never,
      {
        data: { channelId: 'ch-1' },
      } as Job,
    )

    expect(syncChannelArchiveFallbackCache).toHaveBeenCalledWith({}, 'ch-1', '/archive-cache')
    expect(result).toEqual({
      channelId: 'ch-1',
      downloaded: 1,
      skipped: 0,
      pruned: 0,
    })
  })
})

describe('processArchiveFallbackCacheSyncJob', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.ARCHIVE_CACHE_ROOT
  })

  it('no-ops when ARCHIVE_CACHE_ROOT is unset', async () => {
    const summary = await processArchiveFallbackCacheSyncJob({} as never, {} as Job)
    expect(summary).toEqual({ channels: 0, downloaded: 0, skipped: 0, pruned: 0 })
    expect(mockFindMany).not.toHaveBeenCalled()
  })

  it('syncs every channel with ready archive audio', async () => {
    process.env.ARCHIVE_CACHE_ROOT = '/archive-cache'
    mockFindMany.mockResolvedValue([{ id: 'ch-1' }, { id: 'ch-2' }])

    const summary = await processArchiveFallbackCacheSyncJob(
      { channel: { findMany: mockFindMany } } as never,
      {} as Job,
    )

    expect(syncChannelArchiveFallbackCache).toHaveBeenCalledTimes(2)
    expect(summary).toEqual({ channels: 2, downloaded: 2, skipped: 0, pruned: 0 })
  })
})
