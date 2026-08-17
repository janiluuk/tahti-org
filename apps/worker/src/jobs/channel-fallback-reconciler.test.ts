// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Job } from 'bullmq'

vi.mock('../lib/orchestrator.js', () => ({
  spawnOrchestratorChannel: vi.fn().mockResolvedValue(true),
}))

import { processChannelFallbackReconcilerJob } from './channel-fallback-reconciler.js'
import { spawnOrchestratorChannel } from '../lib/orchestrator.js'

const mockFindManyChannel = vi.fn()
const mockFindFirstBroadcast = vi.fn()
const mockCreateBroadcast = vi.fn()
const mockUpdateChannel = vi.fn()

function fakePrisma() {
  return {
    channel: { findMany: mockFindManyChannel, update: mockUpdateChannel },
    broadcast: { findFirst: mockFindFirstBroadcast, create: mockCreateBroadcast },
  } as never
}

describe('processChannelFallbackReconcilerJob', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(spawnOrchestratorChannel).mockResolvedValue(true)
  })

  it('queries only OFFLINE, fallback-enabled channels, excluding Tahti Radio/Selects', async () => {
    mockFindManyChannel.mockResolvedValue([])

    await processChannelFallbackReconcilerJob(fakePrisma(), {} as Job)

    expect(mockFindManyChannel).toHaveBeenCalledWith({
      where: {
        fallbackEnabled: true,
        state: 'OFFLINE',
        slug: { notIn: ['tahti-radio', 'tahti-selects'] },
      },
      select: { id: true, slug: true },
    })
  })

  it('creates a placeholder broadcast, spawns, and flips to LIVE when none exists', async () => {
    mockFindManyChannel.mockResolvedValue([{ id: 'ch-1', slug: 'artist-one' }])
    mockFindFirstBroadcast.mockResolvedValue(null)
    mockCreateBroadcast.mockResolvedValue({ id: 'new-broadcast' })

    const result = await processChannelFallbackReconcilerJob(fakePrisma(), {} as Job)

    expect(mockCreateBroadcast).toHaveBeenCalledWith({
      data: { channelId: 'ch-1', source: 'ICECAST' },
    })
    expect(spawnOrchestratorChannel).toHaveBeenCalledWith(
      'ch-1',
      'artist-one',
      'new-broadcast',
      'channel',
    )
    expect(mockUpdateChannel).toHaveBeenCalledWith({
      where: { id: 'ch-1' },
      data: { state: 'LIVE' },
    })
    expect(result).toEqual({ checked: 1, started: 1 })
  })

  it('reuses an existing open broadcast instead of creating a second one', async () => {
    mockFindManyChannel.mockResolvedValue([{ id: 'ch-1', slug: 'artist-one' }])
    mockFindFirstBroadcast.mockResolvedValue({ id: 'existing-broadcast' })

    await processChannelFallbackReconcilerJob(fakePrisma(), {} as Job)

    expect(mockCreateBroadcast).not.toHaveBeenCalled()
    expect(spawnOrchestratorChannel).toHaveBeenCalledWith(
      'ch-1',
      'artist-one',
      'existing-broadcast',
      'channel',
    )
  })

  it('leaves the channel OFFLINE when the spawn fails', async () => {
    mockFindManyChannel.mockResolvedValue([{ id: 'ch-1', slug: 'artist-one' }])
    mockFindFirstBroadcast.mockResolvedValue({ id: 'existing-broadcast' })
    vi.mocked(spawnOrchestratorChannel).mockResolvedValue(false)

    const result = await processChannelFallbackReconcilerJob(fakePrisma(), {} as Job)

    expect(mockUpdateChannel).not.toHaveBeenCalled()
    expect(result).toEqual({ checked: 1, started: 0 })
  })

  it('bootstraps each qualifying channel independently', async () => {
    mockFindManyChannel.mockResolvedValue([
      { id: 'ch-1', slug: 'artist-one' },
      { id: 'ch-2', slug: 'artist-two' },
    ])
    mockFindFirstBroadcast
      .mockResolvedValueOnce({ id: 'broadcast-1' })
      .mockResolvedValueOnce({ id: 'broadcast-2' })

    const result = await processChannelFallbackReconcilerJob(fakePrisma(), {} as Job)

    expect(spawnOrchestratorChannel).toHaveBeenCalledTimes(2)
    expect(result).toEqual({ checked: 2, started: 2 })
  })
})
