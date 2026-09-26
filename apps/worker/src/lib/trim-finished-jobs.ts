// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Queue } from 'bullmq'

export interface TrimOptions {
  /** Keep records that finished within this window. */
  graceMs: number
  batchSize: number
  pauseMs: number
  onProgress?: (type: 'completed' | 'failed', removedSoFar: number) => void
}

/**
 * Deletes old finished job records in small batches. BullMQ's own count-based
 * trim (removeOnComplete/removeOnFail) deletes everything over the limit in a
 * single Lua call, which blocks Redis when a large backlog exists.
 */
export async function trimFinishedJobs(
  queue: Pick<Queue, 'clean'>,
  { graceMs, batchSize, pauseMs, onProgress }: TrimOptions,
): Promise<{ completed: number; failed: number }> {
  const totals = { completed: 0, failed: 0 }
  for (const type of ['completed', 'failed'] as const) {
    for (;;) {
      const removed = await queue.clean(graceMs, batchSize, type)
      totals[type] += removed.length
      onProgress?.(type, totals[type])
      if (removed.length < batchSize) break
      await new Promise((resolve) => setTimeout(resolve, pauseMs))
    }
  }
  return totals
}
