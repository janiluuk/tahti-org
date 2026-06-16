// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Job } from 'bullmq'

const { prismaMock, queueAdd, queueClose } = vi.hoisted(() => ({
  prismaMock: {
    archiveItem: {
      findMany: vi.fn(),
    },
  },
  queueAdd: vi.fn(),
  queueClose: vi.fn(),
}))

vi.mock('@tahti/db', () => ({ prisma: prismaMock, Prisma: { DbNull: 'DbNull' } }))
vi.mock('bullmq', () => ({
  Queue: vi.fn(() => ({
    add: queueAdd,
    close: queueClose,
  })),
}))

import { processSweepEditorPeaksBackfillJob } from './sweep-editor-peaks-backfill.js'

describe('processSweepEditorPeaksBackfillJob', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queueAdd.mockResolvedValue(undefined)
    queueClose.mockResolvedValue(undefined)
  })

  it('enqueues backfill jobs for items missing editorPeaks', async () => {
    prismaMock.archiveItem.findMany.mockResolvedValue([{ id: 'item-a' }, { id: 'item-b' }])

    const summary = await processSweepEditorPeaksBackfillJob({} as Job)

    expect(summary.enqueued).toBe(2)
    expect(queueAdd).toHaveBeenCalledTimes(2)
    expect(queueAdd).toHaveBeenCalledWith(
      'backfill-editor-peaks',
      { itemId: 'item-a' },
      expect.objectContaining({ jobId: 'backfill-editor-peaks-item-a' }),
    )
  })

  it('returns zero when nothing needs backfill', async () => {
    prismaMock.archiveItem.findMany.mockResolvedValue([])
    const summary = await processSweepEditorPeaksBackfillJob({} as Job)
    expect(summary.enqueued).toBe(0)
    expect(queueAdd).not.toHaveBeenCalled()
  })
})
