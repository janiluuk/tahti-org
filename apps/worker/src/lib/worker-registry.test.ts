// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockConnect = vi.fn()
const mockQuit = vi.fn()
const mockSAdd = vi.fn()
const mockHSet = vi.fn()
const mockLPush = vi.fn()
const mockLTrim = vi.fn()
const mockSMembers = vi.fn()
const mockHGetAll = vi.fn()
const mockSRem = vi.fn()
const mockDel = vi.fn()

vi.mock('redis', () => ({
  createClient: vi.fn(() => ({
    isOpen: true,
    on: vi.fn(),
    connect: mockConnect.mockResolvedValue(undefined),
    quit: mockQuit.mockResolvedValue(undefined),
    sAdd: mockSAdd,
    hSet: mockHSet,
    lPush: mockLPush,
    lTrim: mockLTrim,
    sMembers: mockSMembers,
    hGetAll: mockHGetAll,
    sRem: mockSRem,
    del: mockDel,
  })),
}))

import {
  registerWorker,
  heartbeat,
  recordJobEvent,
  resolveWorkerName,
  pruneStaleWorkers,
} from './worker-registry.js'

describe('resolveWorkerName', () => {
  it('uses WORKER_NAME when set', () => {
    process.env.WORKER_NAME = 'vimage-main'
    expect(resolveWorkerName()).toBe('vimage-main')
    delete process.env.WORKER_NAME
  })

  it('falls back to the hostname when unset', () => {
    delete process.env.WORKER_NAME
    expect(resolveWorkerName().length).toBeGreaterThan(0)
  })
})

describe('worker-registry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSAdd.mockResolvedValue(1)
    mockHSet.mockResolvedValue(1)
    mockLPush.mockResolvedValue(1)
    mockLTrim.mockResolvedValue('OK')
    mockSMembers.mockResolvedValue([])
    mockHGetAll.mockResolvedValue({})
    mockSRem.mockResolvedValue(1)
    mockDel.mockResolvedValue(1)
  })

  it('registerWorker adds the name to the known set and writes lane/host info', async () => {
    await registerWorker('vimage-main', ['media', 'light', 'dist'])
    expect(mockSAdd).toHaveBeenCalledWith('workers:known', 'vimage-main')
    expect(mockHSet).toHaveBeenCalledWith(
      'worker:vimage-main',
      expect.objectContaining({ lanes: 'media,light,dist', status: 'idle' }),
    )
  })

  it('heartbeat only touches updatedAt', async () => {
    await heartbeat('vimage-main')
    expect(mockHSet).toHaveBeenCalledWith(
      'worker:vimage-main',
      expect.objectContaining({ updatedAt: expect.any(String) }),
    )
  })

  it('recordJobEvent updates the hash and pushes onto the capped history list', async () => {
    await recordJobEvent('vimage-main', {
      jobId: '123',
      jobName: 'transcode-sound',
      status: 'completed',
      at: 1_700_000_000_000,
    })
    expect(mockHSet).toHaveBeenCalledWith(
      'worker:vimage-main',
      expect.objectContaining({
        status: 'idle',
        lastJobName: 'transcode-sound',
        lastJobId: '123',
        lastJobStatus: 'completed',
      }),
    )
    expect(mockLPush).toHaveBeenCalledWith(
      'worker:vimage-main:history',
      expect.stringContaining('transcode-sound'),
    )
    expect(mockLTrim).toHaveBeenCalledWith('worker:vimage-main:history', 0, 19)
  })

  it('marks status "processing" for an active job event', async () => {
    await recordJobEvent('vimage-main', {
      jobId: '124',
      jobName: 'separate-stems',
      status: 'active',
      at: 1_700_000_000_000,
    })
    expect(mockHSet).toHaveBeenCalledWith(
      'worker:vimage-main',
      expect.objectContaining({ status: 'processing' }),
    )
  })
})

describe('pruneStaleWorkers', () => {
  const DAY_MS = 24 * 60 * 60 * 1000

  beforeEach(() => {
    vi.clearAllMocks()
    mockSRem.mockResolvedValue(1)
    mockDel.mockResolvedValue(1)
  })

  it('keeps a worker updated within the last 90 days', async () => {
    mockSMembers.mockResolvedValue(['fresh-worker'])
    mockHGetAll.mockResolvedValue({ updatedAt: String(Date.now() - 1 * DAY_MS) })

    const pruned = await pruneStaleWorkers()

    expect(pruned).toEqual([])
    expect(mockSRem).not.toHaveBeenCalled()
    expect(mockDel).not.toHaveBeenCalled()
  })

  it('reaps a worker whose updatedAt is past the 90-day cutoff', async () => {
    mockSMembers.mockResolvedValue(['stale-worker'])
    mockHGetAll.mockResolvedValue({ updatedAt: String(Date.now() - 91 * DAY_MS) })

    const pruned = await pruneStaleWorkers()

    expect(pruned).toEqual(['stale-worker'])
    expect(mockSRem).toHaveBeenCalledWith('workers:known', 'stale-worker')
    expect(mockDel).toHaveBeenCalledWith('worker:stale-worker')
    expect(mockDel).toHaveBeenCalledWith('worker:stale-worker:history')
  })

  it('keeps a worker exactly at the 90-day boundary (not yet past cutoff)', async () => {
    // Frozen clock: otherwise a millisecond passing before pruneStaleWorkers
    // reads Date.now() puts the worker past the cutoff.
    vi.useFakeTimers({ now: new Date('2026-09-26T12:00:00Z') })
    try {
      mockSMembers.mockResolvedValue(['boundary-worker'])
      mockHGetAll.mockResolvedValue({ updatedAt: String(Date.now() - 90 * DAY_MS) })

      const pruned = await pruneStaleWorkers()

      expect(pruned).toEqual([])
      expect(mockSRem).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('reaps an orphaned registry entry with no hash data at all', async () => {
    mockSMembers.mockResolvedValue(['orphan-worker'])
    mockHGetAll.mockResolvedValue({})

    const pruned = await pruneStaleWorkers()

    expect(pruned).toEqual(['orphan-worker'])
    expect(mockSRem).toHaveBeenCalledWith('workers:known', 'orphan-worker')
  })

  it('reaps an entry with a missing/unparseable updatedAt', async () => {
    mockSMembers.mockResolvedValue(['bad-worker'])
    mockHGetAll.mockResolvedValue({ lanes: 'media' })

    const pruned = await pruneStaleWorkers()

    expect(pruned).toEqual(['bad-worker'])
  })

  it('prunes only the stale entries out of a mixed set', async () => {
    mockSMembers.mockResolvedValue(['fresh-worker', 'stale-worker'])
    mockHGetAll.mockImplementation(async (key: string) =>
      key === 'worker:fresh-worker'
        ? { updatedAt: String(Date.now() - 1 * DAY_MS) }
        : { updatedAt: String(Date.now() - 91 * DAY_MS) },
    )

    const pruned = await pruneStaleWorkers()

    expect(pruned).toEqual(['stale-worker'])
    expect(mockSRem).toHaveBeenCalledTimes(1)
    expect(mockSRem).toHaveBeenCalledWith('workers:known', 'stale-worker')
  })
})
