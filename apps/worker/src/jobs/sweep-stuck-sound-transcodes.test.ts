// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { prismaMock, queueAdd, queueClose, queueGetJobs } = vi.hoisted(() => ({
  prismaMock: {
    sound: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
  },
  queueAdd: vi.fn(),
  queueClose: vi.fn(),
  queueGetJobs: vi.fn(),
}))

vi.mock('@tahti/db', () => ({ prisma: prismaMock }))
vi.mock('bullmq', () => ({
  Queue: vi.fn(() => ({ add: queueAdd, close: queueClose, getJobs: queueGetJobs })),
}))

import {
  STUCK_TRANSCODE_AFTER_MS,
  STUCK_TRANSCODE_BATCH,
  processSweepStuckSoundTranscodesJob,
} from './sweep-stuck-sound-transcodes.js'

const NOW = new Date('2026-11-11T12:00:00Z')

describe('processSweepStuckSoundTranscodesJob', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    queueAdd.mockResolvedValue(undefined)
    queueClose.mockResolvedValue(undefined)
    queueGetJobs.mockResolvedValue([])
    prismaMock.sound.updateMany.mockResolvedValue({ count: 1 })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('looks only at uploaded sounds untouched for an hour, oldest first, bounded', async () => {
    prismaMock.sound.findMany.mockResolvedValue([])

    const summary = await processSweepStuckSoundTranscodesJob()

    expect(summary).toEqual({ stuck: 0, enqueued: 0 })
    const args = prismaMock.sound.findMany.mock.calls[0]![0]
    expect(args.where).toEqual({
      status: { in: ['PENDING', 'PROCESSING'] },
      rawKey: { not: null },
      updatedAt: { lt: new Date(NOW.getTime() - STUCK_TRANSCODE_AFTER_MS) },
    })
    expect(args.take).toBe(STUCK_TRANSCODE_BATCH)
    expect(args.orderBy).toEqual({ updatedAt: 'asc' })
    expect(queueGetJobs).not.toHaveBeenCalled()
  })

  it('re-queues stuck sounds that have no transcode job left', async () => {
    prismaMock.sound.findMany.mockResolvedValue([{ id: 's1' }, { id: 's2' }])

    const summary = await processSweepStuckSoundTranscodesJob()

    expect(summary).toEqual({ stuck: 2, enqueued: 2 })
    expect(queueAdd).toHaveBeenCalledWith('transcode-sound', { itemId: 's1' })
    expect(queueAdd).toHaveBeenCalledWith('transcode-sound', { itemId: 's2' })
    expect(prismaMock.sound.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: 's1', rawKey: { not: null } }),
      data: { status: 'PENDING', processingError: null },
    })
    expect(queueClose).toHaveBeenCalled()
  })

  it('skips a sound whose transcode job is still queued', async () => {
    prismaMock.sound.findMany.mockResolvedValue([{ id: 's1' }, { id: 's2' }])
    queueGetJobs.mockResolvedValue([
      { name: 'transcode-sound', data: { itemId: 's1' } },
      { name: 'backfill-editor-peaks', data: { itemId: 's2' } },
    ])

    const summary = await processSweepStuckSoundTranscodesJob()

    expect(summary.enqueued).toBe(1)
    expect(queueAdd).toHaveBeenCalledTimes(1)
    expect(queueAdd).toHaveBeenCalledWith('transcode-sound', { itemId: 's2' })
  })

  it('does not queue a sound that changed since it was read', async () => {
    prismaMock.sound.findMany.mockResolvedValue([{ id: 's1' }])
    prismaMock.sound.updateMany.mockResolvedValue({ count: 0 })

    const summary = await processSweepStuckSoundTranscodesJob()

    expect(summary.enqueued).toBe(0)
    expect(queueAdd).not.toHaveBeenCalled()
  })
})
