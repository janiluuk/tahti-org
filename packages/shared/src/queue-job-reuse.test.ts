// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it, vi } from 'vitest'

import { clearFinishedJob } from './queue-job-reuse.js'

function queueWith(state: string | null, remove = vi.fn().mockResolvedValue(undefined)) {
  return {
    remove,
    queue: {
      getJob: vi
        .fn()
        .mockResolvedValue(state ? { getState: async () => state, remove } : undefined),
    },
  }
}

describe('clearFinishedJob', () => {
  it.each(['failed', 'completed'])(
    'removes a %s job so the id can be added again',
    async (state) => {
      const { queue, remove } = queueWith(state)
      await clearFinishedJob(queue, 'hearthis-embed-localize-s1')
      expect(queue.getJob).toHaveBeenCalledWith('hearthis-embed-localize-s1')
      expect(remove).toHaveBeenCalledTimes(1)
    },
  )

  it.each(['waiting', 'delayed', 'active', 'prioritized'])('keeps a %s job', async (state) => {
    const { queue, remove } = queueWith(state)
    await clearFinishedJob(queue, 'x')
    expect(remove).not.toHaveBeenCalled()
  })

  it('does nothing when no job has that id', async () => {
    const { queue, remove } = queueWith(null)
    await clearFinishedJob(queue, 'x')
    expect(remove).not.toHaveBeenCalled()
  })

  it('tolerates a concurrent removal', async () => {
    const { queue } = queueWith('failed', vi.fn().mockRejectedValue(new Error('Missing key')))
    await expect(clearFinishedJob(queue, 'x')).resolves.toBeUndefined()
  })
})
