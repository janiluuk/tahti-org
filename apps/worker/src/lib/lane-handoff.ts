// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { DelayedError, type Job } from 'bullmq'

export const LANE_HANDOFF_MIN_DELAY_MS = 2_000
export const LANE_HANDOFF_JITTER_MS = 3_000

/**
 * A repeatable tick that only wrong-lane workers keep picking up is dropped
 * after this many hand-offs (about a minute). The next tick replaces it, and
 * without a cap a lane with no live worker would pile up one bouncing tick per
 * interval forever (hls-minio-sync repeats every 4s).
 */
export const MAX_REPEAT_TICK_HANDOFFS = 20

export type LaneHandoffJob = Pick<
  Job,
  'name' | 'attemptsStarted' | 'repeatJobKey' | 'opts' | 'moveToDelayed'
>

export function isJobInLanes(allowedJobNames: ReadonlySet<string>, jobName: string): boolean {
  return allowedJobNames.size === 0 || allowedJobNames.has(jobName)
}

function isRepeatTick(job: LaneHandoffJob): boolean {
  return Boolean(job.repeatJobKey || job.opts.repeat)
}

/**
 * Puts a job this worker's lanes do not cover back in the queue for another
 * worker. Every queue shares one BullMQ queue (`media`), so a worker cannot
 * avoid dequeuing other lanes' jobs; throwing would use up one of the job's
 * attempts each time, and a busy wrong-lane worker can then fail the job for
 * good before the right worker ever sees it. moveToDelayed skips the attempt
 * count, and the jitter keeps two wrong-lane workers from handing the same job
 * back and forth in lockstep.
 *
 * Throws DelayedError (BullMQ's signal that the processor already moved the
 * job) unless a stale repeat tick is dropped, in which case it resolves.
 */
export async function handOffToOtherLane(
  job: LaneHandoffJob,
  token: string | undefined,
  random: () => number = Math.random,
): Promise<{ skipped: 'lane-mismatch' }> {
  if (isRepeatTick(job) && job.attemptsStarted > MAX_REPEAT_TICK_HANDOFFS) {
    return { skipped: 'lane-mismatch' }
  }
  const delayMs = LANE_HANDOFF_MIN_DELAY_MS + Math.floor(random() * LANE_HANDOFF_JITTER_MS)
  await job.moveToDelayed(Date.now() + delayMs, token)
  throw new DelayedError()
}
