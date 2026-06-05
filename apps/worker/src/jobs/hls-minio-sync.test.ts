// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Job } from 'bullmq'

vi.mock('../lib/hls-minio-sync.js', () => ({
  syncChannelHlsToMinio: vi.fn().mockResolvedValue({ uploaded: 2, skipped: 0 }),
}))

import { processHlsMinioSyncJob } from './hls-minio-sync.js'
import { syncChannelHlsToMinio } from '../lib/hls-minio-sync.js'

const mockFindMany = vi.fn()

describe('processHlsMinioSyncJob', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.HLS_SEGMENT_ROOT
  })

  it('no-ops when HLS_SEGMENT_ROOT is unset', async () => {
    const summary = await processHlsMinioSyncJob(
      { channel: { findMany: mockFindMany } } as never,
      {} as Job,
    )
    expect(summary).toEqual({ channels: 0, uploaded: 0, skipped: 0 })
    expect(mockFindMany).not.toHaveBeenCalled()
  })

  it('syncs each live channel under slug prefix', async () => {
    process.env.HLS_SEGMENT_ROOT = '/hls'
    mockFindMany.mockResolvedValue([
      { id: 'ch-1', slug: 'artist-a' },
      { id: 'ch-2', slug: 'artist-b' },
    ])

    const summary = await processHlsMinioSyncJob(
      { channel: { findMany: mockFindMany } } as never,
      {} as Job,
    )

    expect(syncChannelHlsToMinio).toHaveBeenCalledTimes(2)
    expect(syncChannelHlsToMinio).toHaveBeenCalledWith('/hls', 'ch-1', 'artist-a')
    expect(summary).toEqual({ channels: 2, uploaded: 4, skipped: 0 })
  })
})
