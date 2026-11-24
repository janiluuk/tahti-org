// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { redisSet, redisMGet, stopChannel, endBroadcast } = vi.hoisted(() => ({
  redisSet: vi.fn(),
  redisMGet: vi.fn(),
  stopChannel: vi.fn(),
  endBroadcast: vi.fn(),
}))

vi.mock('redis', () => ({
  createClient: () => ({
    connect: async () => undefined,
    quit: async () => undefined,
    set: redisSet,
    mGet: redisMGet,
  }),
}))
vi.mock('./orchestrator.js', () => ({ stopOrchestratorChannel: stopChannel }))
vi.mock('@tahti/shared/broadcast-end', () => ({ endBroadcast }))

import {
  channelsInDeadAirCooldown,
  DEAD_AIR_COOLDOWN_SEC,
  shutDownDeadAirChannel,
} from './dead-air.js'

const update = vi.fn()
const prisma = { channel: { update } } as never

describe('shutDownDeadAirChannel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('stops the stream, ends the broadcast, goes OFFLINE, cools down and logs', async () => {
    await shutDownDeadAirChannel(prisma, {
      id: 'ch-1',
      slug: 'artist',
      broadcastId: 'b-1',
      segmentAgeSec: 900,
      restartCount: 3,
    })

    expect(stopChannel).toHaveBeenCalledWith('ch-1')
    expect(endBroadcast).toHaveBeenCalledWith(prisma, 'b-1')
    expect(update).toHaveBeenCalledWith({
      where: { id: 'ch-1' },
      data: { state: 'OFFLINE', goneLiveAt: null },
    })
    expect(redisSet).toHaveBeenCalledWith('channel:dead-air:ch-1', expect.any(String), {
      EX: DEAD_AIR_COOLDOWN_SEC,
    })
    const entry = JSON.parse(String(vi.mocked(console.warn).mock.calls[0]![0]))
    expect(entry).toMatchObject({
      msg: 'dead air: stream shut down',
      reason: 'dead-air',
      slug: 'artist',
      segmentAgeSec: 900,
      restartsInWindow: 3,
    })
  })
})

describe('channelsInDeadAirCooldown', () => {
  it('returns the ids whose cooldown key is still set', async () => {
    redisMGet.mockResolvedValue(['2026-11-24T00:00:00Z', null])
    expect(await channelsInDeadAirCooldown(['a', 'b'])).toEqual(new Set(['a']))
    expect(redisMGet).toHaveBeenCalledWith(['channel:dead-air:a', 'channel:dead-air:b'])
  })

  it('skips Redis when there is nothing to check', async () => {
    redisMGet.mockClear()
    expect(await channelsInDeadAirCooldown([])).toEqual(new Set())
    expect(redisMGet).not.toHaveBeenCalled()
  })
})
