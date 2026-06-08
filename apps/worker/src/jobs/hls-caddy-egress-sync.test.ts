// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Job } from 'bullmq'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const mockConnect = vi.fn()
const mockQuit = vi.fn()
const mockGet = vi.fn()
const mockSet = vi.fn()
const mockIncrBy = vi.fn()
const mockExpire = vi.fn()
const mockSAdd = vi.fn()

vi.mock('redis', () => ({
  createClient: vi.fn(() => ({
    connect: mockConnect.mockResolvedValue(undefined),
    quit: mockQuit.mockResolvedValue(undefined),
    get: mockGet,
    set: mockSet,
    incrBy: mockIncrBy,
    expire: mockExpire,
    sAdd: mockSAdd,
  })),
}))

import { processHlsCaddyEgressSyncJob } from './hls-caddy-egress-sync.js'

describe('processHlsCaddyEgressSyncJob', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGet.mockResolvedValue('0')
    mockIncrBy.mockResolvedValue(1)
    mockSAdd.mockResolvedValue(1)
    delete process.env.CADDY_HLS_ACCESS_LOG
  })

  it('no-ops when log path is unset', async () => {
    const summary = await processHlsCaddyEgressSyncJob({} as Job)
    expect(summary).toEqual({ lines: 0, bytes: 0 })
    expect(mockConnect).not.toHaveBeenCalled()
  })

  it('increments redis counters and adds anonymized listener ids from log lines', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tahti-caddy-job-'))
    const path = join(dir, 'hls-access.log')
    const line = JSON.stringify({
      ts: 1_700_000_000,
      status: 200,
      size: 512,
      request: { uri: '/artist-x/stream.m3u8', client_ip: '203.0.113.7' },
    })
    await writeFile(path, `${line}\n`)
    process.env.CADDY_HLS_ACCESS_LOG = path

    const summary = await processHlsCaddyEgressSyncJob({} as Job)
    expect(summary.lines).toBe(1)
    expect(summary.bytes).toBe(512)
    expect(mockIncrBy).toHaveBeenCalledWith('tahti:hls-egress:artist-x:2023-11-14', 512)

    expect(mockSAdd).toHaveBeenCalledTimes(1)
    const [listenersKey, listenerHash] = mockSAdd.mock.calls[0] as [string, string]
    expect(listenersKey).toBe('tahti:hls-listeners:artist-x:2023-11-14')
    expect(listenerHash).toMatch(/^[0-9a-f]{64}$/)
    expect(listenerHash).not.toContain('203.0.113.7')

    await rm(dir, { recursive: true, force: true })
  })

  it('skips listener tracking when the log line has no client IP', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tahti-caddy-job-'))
    const path = join(dir, 'hls-access.log')
    const line = JSON.stringify({
      ts: 1_700_000_000,
      status: 200,
      size: 256,
      request: { uri: '/artist-x/seg-1.ts' },
    })
    await writeFile(path, `${line}\n`)
    process.env.CADDY_HLS_ACCESS_LOG = path

    await processHlsCaddyEgressSyncJob({} as Job)
    expect(mockSAdd).not.toHaveBeenCalled()

    await rm(dir, { recursive: true, force: true })
  })
})
