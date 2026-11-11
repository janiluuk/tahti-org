// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DelayedError } from 'bullmq'

import {
  LANE_HANDOFF_JITTER_MS,
  LANE_HANDOFF_MIN_DELAY_MS,
  MAX_REPEAT_TICK_HANDOFFS,
  handOffToOtherLane,
  isJobInLanes,
  type LaneHandoffJob,
} from './lane-handoff.js'

const NOW = 1_800_000_000_000

function fakeJob(overrides: Partial<LaneHandoffJob> = {}) {
  const moveToDelayed = vi.fn().mockResolvedValue(undefined)
  const job = {
    name: 'transcode-sound',
    attemptsStarted: 1,
    repeatJobKey: undefined,
    opts: { attempts: 3 },
    moveToDelayed,
    ...overrides,
  } as LaneHandoffJob
  return { job, moveToDelayed }
}

describe('isJobInLanes', () => {
  it('accepts every job when no lane filter is set', () => {
    expect(isJobInLanes(new Set(), 'transcode-sound')).toBe(true)
  })

  it('accepts only the lane filter’s job names', () => {
    const allowed = new Set(['hls-minio-sync'])
    expect(isJobInLanes(allowed, 'hls-minio-sync')).toBe(true)
    expect(isJobInLanes(allowed, 'transcode-sound')).toBe(false)
  })
})

describe('handOffToOtherLane', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('delays the job with its lock token and signals BullMQ with DelayedError', async () => {
    const { job, moveToDelayed } = fakeJob()

    await expect(handOffToOtherLane(job, 'lock-token', () => 0)).rejects.toBeInstanceOf(
      DelayedError,
    )
    expect(moveToDelayed).toHaveBeenCalledWith(NOW + LANE_HANDOFF_MIN_DELAY_MS, 'lock-token')
  })

  it('jitters the delay within the hand-off window', async () => {
    const { job, moveToDelayed } = fakeJob()

    await expect(handOffToOtherLane(job, 't', () => 0.999)).rejects.toBeInstanceOf(DelayedError)
    const at = moveToDelayed.mock.calls[0]![0] as number
    expect(at - NOW).toBeGreaterThanOrEqual(LANE_HANDOFF_MIN_DELAY_MS)
    expect(at - NOW).toBeLessThan(LANE_HANDOFF_MIN_DELAY_MS + LANE_HANDOFF_JITTER_MS)
  })

  it('keeps handing off a one-off job however often it bounced', async () => {
    const { job, moveToDelayed } = fakeJob({ attemptsStarted: 500 })

    await expect(handOffToOtherLane(job, 't')).rejects.toBeInstanceOf(DelayedError)
    expect(moveToDelayed).toHaveBeenCalledTimes(1)
  })

  it('hands off a repeat tick while it is fresh', async () => {
    const { job, moveToDelayed } = fakeJob({
      name: 'hls-minio-sync',
      repeatJobKey: 'hls-minio-sync-cron',
      opts: { repeat: { every: 4000 } },
      attemptsStarted: MAX_REPEAT_TICK_HANDOFFS,
    })

    await expect(handOffToOtherLane(job, 't')).rejects.toBeInstanceOf(DelayedError)
    expect(moveToDelayed).toHaveBeenCalledTimes(1)
  })

  it('drops a repeat tick that no right-lane worker took, leaving the next tick to run', async () => {
    const { job, moveToDelayed } = fakeJob({
      name: 'hls-minio-sync',
      repeatJobKey: 'hls-minio-sync-cron',
      opts: { repeat: { every: 4000 } },
      attemptsStarted: MAX_REPEAT_TICK_HANDOFFS + 1,
    })

    await expect(handOffToOtherLane(job, 't')).resolves.toEqual({ skipped: 'lane-mismatch' })
    expect(moveToDelayed).not.toHaveBeenCalled()
  })
})
