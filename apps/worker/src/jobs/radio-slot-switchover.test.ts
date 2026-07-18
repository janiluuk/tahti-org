// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Job } from 'bullmq'

vi.mock('../lib/orchestrator.js', () => ({
  restartChannelLiquidsoap: vi.fn().mockResolvedValue(undefined),
  spawnOrchestratorChannel: vi.fn().mockResolvedValue(undefined),
}))

import { processRadioSlotSwitchoverJob } from './radio-slot-switchover.js'
import { restartChannelLiquidsoap, spawnOrchestratorChannel } from '../lib/orchestrator.js'

const mockFindUniqueChannel = vi.fn()
const mockFindFirstBroadcast = vi.fn()
const mockCreateBroadcast = vi.fn()
const mockUpdateChannel = vi.fn()
const mockFindFirstBooking = vi.fn()

function fakePrisma() {
  return {
    channel: { findUnique: mockFindUniqueChannel, update: mockUpdateChannel },
    broadcast: { findFirst: mockFindFirstBroadcast, create: mockCreateBroadcast },
    radioSlotBooking: { findFirst: mockFindFirstBooking },
  } as never
}

describe('processRadioSlotSwitchoverJob', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFindFirstBroadcast.mockResolvedValue({ id: 'broadcast-1' })
  })

  it('no-ops when the tahti-radio channel does not exist', async () => {
    mockFindUniqueChannel.mockResolvedValue(null)

    const result = await processRadioSlotSwitchoverJob(fakePrisma(), {} as Job)

    expect(result).toEqual({ liveArtistSlug: null, switched: false })
    expect(spawnOrchestratorChannel).not.toHaveBeenCalled()
  })

  it('creates a persistent placeholder broadcast when none exists', async () => {
    mockFindUniqueChannel.mockResolvedValue({ id: 'radio-ch', liveInputOverrideSlug: null })
    mockFindFirstBroadcast.mockResolvedValue(null)
    mockCreateBroadcast.mockResolvedValue({ id: 'new-broadcast' })
    mockFindFirstBooking.mockResolvedValue(null)

    await processRadioSlotSwitchoverJob(fakePrisma(), {} as Job)

    expect(mockCreateBroadcast).toHaveBeenCalledWith({
      data: { channelId: 'radio-ch', source: 'ICECAST' },
    })
  })

  it('always ensures the orchestrator has the channel spawned (idempotent)', async () => {
    mockFindUniqueChannel.mockResolvedValue({ id: 'radio-ch', liveInputOverrideSlug: null })
    mockFindFirstBooking.mockResolvedValue(null)

    await processRadioSlotSwitchoverJob(fakePrisma(), {} as Job)

    expect(spawnOrchestratorChannel).toHaveBeenCalledWith(
      'radio-ch',
      'tahti-radio',
      'broadcast-1',
      'channel',
    )
  })

  it('does nothing when no booking is active and no override is set', async () => {
    mockFindUniqueChannel.mockResolvedValue({ id: 'radio-ch', liveInputOverrideSlug: null })
    mockFindFirstBooking.mockResolvedValue(null)

    const result = await processRadioSlotSwitchoverJob(fakePrisma(), {} as Job)

    expect(result).toEqual({ liveArtistSlug: null, switched: false })
    expect(restartChannelLiquidsoap).not.toHaveBeenCalled()
    expect(mockUpdateChannel).not.toHaveBeenCalled()
  })

  it('switches to the booked artist when a slot becomes active', async () => {
    mockFindUniqueChannel.mockResolvedValue({ id: 'radio-ch', liveInputOverrideSlug: null })
    mockFindFirstBooking.mockResolvedValue({ channel: { slug: 'some-artist' } })

    const result = await processRadioSlotSwitchoverJob(fakePrisma(), {} as Job)

    expect(result).toEqual({ liveArtistSlug: 'some-artist', switched: true })
    expect(mockUpdateChannel).toHaveBeenCalledWith({
      where: { id: 'radio-ch' },
      data: { liveInputOverrideSlug: 'some-artist' },
    })
    expect(restartChannelLiquidsoap).toHaveBeenCalledWith(
      'radio-ch',
      'tahti-radio',
      'broadcast-1',
      'channel',
    )
  })

  it('switches back to rotation fallback when the slot ends', async () => {
    mockFindUniqueChannel.mockResolvedValue({
      id: 'radio-ch',
      liveInputOverrideSlug: 'some-artist',
    })
    mockFindFirstBooking.mockResolvedValue(null)

    const result = await processRadioSlotSwitchoverJob(fakePrisma(), {} as Job)

    expect(result).toEqual({ liveArtistSlug: null, switched: true })
    expect(mockUpdateChannel).toHaveBeenCalledWith({
      where: { id: 'radio-ch' },
      data: { liveInputOverrideSlug: null },
    })
    expect(restartChannelLiquidsoap).toHaveBeenCalledTimes(1)
  })

  it('does not restart when already pointed at the currently active booking', async () => {
    mockFindUniqueChannel.mockResolvedValue({
      id: 'radio-ch',
      liveInputOverrideSlug: 'some-artist',
    })
    mockFindFirstBooking.mockResolvedValue({ channel: { slug: 'some-artist' } })

    const result = await processRadioSlotSwitchoverJob(fakePrisma(), {} as Job)

    expect(result).toEqual({ liveArtistSlug: 'some-artist', switched: false })
    expect(restartChannelLiquidsoap).not.toHaveBeenCalled()
  })
})
