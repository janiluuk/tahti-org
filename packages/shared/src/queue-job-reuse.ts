// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/** Structural slice of a BullMQ Queue, so this package stays free of bullmq. */
export interface FinishedJobLookup {
  getJob(jobId: string): Promise<
    | {
        getState(): Promise<string>
        remove(): Promise<unknown>
      }
    | undefined
    | null
  >
}

const FINISHED_STATES = new Set(['completed', 'failed'])

/**
 * BullMQ silently ignores `add` for a jobId that still exists, including a
 * finished one kept by removeOnComplete/removeOnFail. Call this before adding
 * a job with a fixed per-entity jobId so a retry after a failure actually
 * queues. A waiting, delayed or active job is left alone, so `add` stays a
 * no-op for it and the work is queued once.
 */
export async function clearFinishedJob(queue: FinishedJobLookup, jobId: string): Promise<void> {
  const existing = await queue.getJob(jobId)
  if (!existing) return
  if (!FINISHED_STATES.has(await existing.getState())) return
  try {
    await existing.remove()
  } catch {
    // A concurrent enqueue removed it first; the add that follows is what matters.
  }
}
