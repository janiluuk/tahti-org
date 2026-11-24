// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Job } from 'bullmq'

vi.mock('../lib/orchestrator.js', () => ({
  spawnOrchestratorChannel: vi.fn().mockResolvedValue(true),
}))

vi.mock('../lib/dead-air.js', () => ({
  channelsInDeadAirCooldown: vi.fn().mockResolvedValue(new Set()),
}))

import { processChannelFallbackReconcilerJob } from './channel-fallback-reconciler.js'
import { channelsInDeadAirCooldown } from '../lib/dead-air.js'
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
    vi.mocked(channelsInDeadAirCooldown).mockResolvedValue(new Set())
  })

  it('leaves a channel shut down for dead air alone until its cooldown ends', async () => {
    mockFindManyChannel.mockResolvedValue([
      { id: 'ch-dead', slug: 'dead' },
      { id: 'ch-ok', slug: 'ok' },
    ])
    mockFindFirstBroadcast.mockResolvedValue({ id: 'b-1' })
    vi.mocked(channelsInDeadAirCooldown).mockResolvedValue(new Set(['ch-dead']))

    const result = await processChannelFallbackReconcilerJob(fakePrisma(), {} as Job)

    expect(spawnOrchestratorChannel).toHaveBeenCalledTimes(1)
    expect(spawnOrchestratorChannel).toHaveBeenCalledWith('ch-ok', 'ok', 'b-1', 'channel')
    expect(result).toEqual({ checked: 2, started: 1, coolingDown: 1 })
  })

  it('queries OFFLINE fallback channels plus Tahti Selects, excluding Tahti Radio', async () => {
    mockFindManyChannel.mockResolvedValue([])

    await processChannelFallbackReconcilerJob(fakePrisma(), {} as Job)

    expect(mockFindManyChannel).toHaveBeenCalledWith({
      where: {
        state: 'OFFLINE',
        OR: [{ fallbackEnabled: true }, { slug: 'tahti-selects' }],
        slug: { not: 'tahti-radio' },
      },
      select: { id: true, slug: true },
    })
  })

  it('spawns Tahti Selects with the rotation template', async () => {
    mockFindManyChannel.mockResolvedValue([{ id: 'ch-sel', slug: 'tahti-selects' }])
    mockFindFirstBroadcast.mockResolvedValue({ id: 'sel-broadcast' })

    await processChannelFallbackReconcilerJob(fakePrisma(), {} as Job)

    expect(spawnOrchestratorChannel).toHaveBeenCalledWith(
      'ch-sel',
      'tahti-selects',
      'sel-broadcast',
      'rotation',
    )
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
    expect(result).toEqual({ checked: 1, started: 1, coolingDown: 0 })
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
    expect(result).toEqual({ checked: 1, started: 0, coolingDown: 0 })
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
    expect(result).toEqual({ checked: 2, started: 2, coolingDown: 0 })
  })
})
