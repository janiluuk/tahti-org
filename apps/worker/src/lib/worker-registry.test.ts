// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockConnect = vi.fn()
const mockQuit = vi.fn()
const mockSAdd = vi.fn()
const mockHSet = vi.fn()
const mockLPush = vi.fn()
const mockLTrim = vi.fn()

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
  })),
}))

import { registerWorker, heartbeat, recordJobEvent, resolveWorkerName } from './worker-registry.js'

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
      jobName: 'transcode-archive',
      status: 'completed',
      at: 1_700_000_000_000,
    })
    expect(mockHSet).toHaveBeenCalledWith(
      'worker:vimage-main',
      expect.objectContaining({
        status: 'idle',
        lastJobName: 'transcode-archive',
        lastJobId: '123',
        lastJobStatus: 'completed',
      }),
    )
    expect(mockLPush).toHaveBeenCalledWith(
      'worker:vimage-main:history',
      expect.stringContaining('transcode-archive'),
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
