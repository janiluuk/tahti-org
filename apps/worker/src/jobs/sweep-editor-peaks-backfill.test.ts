// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Job } from 'bullmq'

const { prismaMock, queueAdd, queueClose, queueGetJob } = vi.hoisted(() => ({
  prismaMock: {
    sound: {
      findMany: vi.fn(),
    },
  },
  queueAdd: vi.fn(),
  queueClose: vi.fn(),
  queueGetJob: vi.fn(),
}))

vi.mock('@tahti/db', () => ({ prisma: prismaMock, Prisma: { DbNull: 'DbNull' } }))
vi.mock('bullmq', () => ({
  Queue: vi.fn(() => ({
    add: queueAdd,
    close: queueClose,
    getJob: queueGetJob,
  })),
}))

import { processSweepEditorPeaksBackfillJob } from './sweep-editor-peaks-backfill.js'

describe('processSweepEditorPeaksBackfillJob', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queueAdd.mockResolvedValue(undefined)
    queueClose.mockResolvedValue(undefined)
    queueGetJob.mockResolvedValue(undefined)
  })

  it('enqueues backfill jobs for items missing editorPeaks', async () => {
    prismaMock.sound.findMany.mockResolvedValue([{ id: 'item-a' }, { id: 'item-b' }])

    const summary = await processSweepEditorPeaksBackfillJob({} as Job)

    expect(summary.enqueued).toBe(2)
    expect(queueAdd).toHaveBeenCalledTimes(2)
    expect(queueAdd).toHaveBeenCalledWith(
      'backfill-editor-peaks',
      { itemId: 'item-a' },
      expect.objectContaining({ jobId: 'backfill-editor-peaks-item-a' }),
    )
  })

  it('skips sounds without audio so embed-only rows cannot stall the oldest-first sweep', async () => {
    prismaMock.sound.findMany.mockResolvedValue([])
    await processSweepEditorPeaksBackfillJob({} as Job)
    const { where } = prismaMock.sound.findMany.mock.calls[0]![0]
    expect(where.AND).toEqual([
      { OR: [{ flacKey: { not: null } }, { rawKey: { not: null } }, { mp3Key: { not: null } }] },
    ])
  })

  it('clears a failed backfill job with the same id so the sound is retried', async () => {
    prismaMock.sound.findMany.mockResolvedValue([{ id: 'item-a' }])
    const remove = vi.fn().mockResolvedValue(undefined)
    queueGetJob.mockResolvedValue({ getState: async () => 'failed', remove })

    await processSweepEditorPeaksBackfillJob({} as Job)

    expect(queueGetJob).toHaveBeenCalledWith('backfill-editor-peaks-item-a')
    expect(remove).toHaveBeenCalled()
    expect(remove.mock.invocationCallOrder[0]).toBeLessThan(queueAdd.mock.invocationCallOrder[0]!)
  })

  it('returns zero when nothing needs backfill', async () => {
    prismaMock.sound.findMany.mockResolvedValue([])
    const summary = await processSweepEditorPeaksBackfillJob({} as Job)
    expect(summary.enqueued).toBe(0)
    expect(queueAdd).not.toHaveBeenCalled()
  })
})
