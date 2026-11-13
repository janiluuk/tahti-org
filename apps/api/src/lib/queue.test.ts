// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { beforeEach, describe, expect, it, vi } from 'vitest'

const { queueAdd, queueGetJob } = vi.hoisted(() => ({
  queueAdd: vi.fn(),
  queueGetJob: vi.fn(),
}))

vi.mock('bullmq', () => ({
  Queue: vi.fn(() => ({ add: queueAdd, getJob: queueGetJob })),
  QueueEvents: vi.fn(() => ({})),
}))

import {
  enqueueBackfillEditorPeaks,
  enqueueEncodeStreamingCopy,
  enqueueHearthisEmbedLocalization,
  enqueueHearthisExport,
} from './queue.js'

const fixedIdEnqueues = [
  {
    name: 'hearthis-embed-localize',
    jobId: 'hearthis-embed-localize-s1',
    run: () =>
      enqueueHearthisEmbedLocalization({ soundId: 's1', trackUrl: 'https://hearthis.at/a/b/' }),
  },
  {
    name: 'encode-streaming-copy',
    jobId: 'encode-streaming-copy-s1',
    run: () => enqueueEncodeStreamingCopy('s1'),
  },
  {
    name: 'backfill-editor-peaks',
    jobId: 'backfill-editor-peaks-s1',
    run: () => enqueueBackfillEditorPeaks('s1'),
  },
  {
    name: 'hearthis-export',
    jobId: 'hearthis-export-s1',
    run: () => enqueueHearthisExport('s1'),
  },
]

describe('fixed-jobId enqueues', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queueAdd.mockResolvedValue(undefined)
  })

  it.each(fixedIdEnqueues)(
    '$name removes a failed job with the same id before adding',
    async ({ name, jobId, run }) => {
      const remove = vi.fn().mockResolvedValue(undefined)
      queueGetJob.mockResolvedValue({ getState: async () => 'failed', remove })

      await run()

      expect(queueGetJob).toHaveBeenCalledWith(jobId)
      expect(remove).toHaveBeenCalledTimes(1)
      expect(queueAdd).toHaveBeenCalledWith(
        name,
        expect.anything(),
        expect.objectContaining({ jobId }),
      )
      expect(remove.mock.invocationCallOrder[0]).toBeLessThan(queueAdd.mock.invocationCallOrder[0]!)
    },
  )

  it.each(fixedIdEnqueues)('$name keeps a job that is still queued', async ({ run }) => {
    const remove = vi.fn()
    queueGetJob.mockResolvedValue({ getState: async () => 'delayed', remove })

    await run()

    expect(remove).not.toHaveBeenCalled()
    expect(queueAdd).toHaveBeenCalledTimes(1)
  })
})
