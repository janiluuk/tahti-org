// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Job } from 'bullmq'
import { prisma } from '@tahti/db'
import { soundProcessingErrorMessage } from './sound-processing-error.js'

export type FailedTranscodeJob = Pick<Job, 'name' | 'data' | 'attemptsMade' | 'opts'>

/** Read after BullMQ's moveToFailed, which has already counted the attempt that just failed. */
export function hasExhaustedAttempts(job: FailedTranscodeJob, err: Error): boolean {
  if (err.name === 'UnrecoverableError') return true
  return job.attemptsMade >= (job.opts.attempts ?? 1)
}

/**
 * Worker 'failed' handler for transcode-sound. processTranscodeJob marks the
 * sound ERROR itself when its last attempt fails inside the transcode, but a
 * failure before that (sound lookup, the PROCESSING update) would leave the
 * sound PENDING with no job left.
 * ERROR is what the owner's retry button acts on. Only PENDING/PROCESSING rows
 * change, so a READY sound or an already-written stage message is kept.
 */
export async function markSoundTranscodeFailed(
  job: FailedTranscodeJob,
  err: Error,
): Promise<boolean> {
  if (job.name !== 'transcode-sound') return false
  if (!hasExhaustedAttempts(job, err)) return false
  const { itemId } = job.data as { itemId?: string }
  if (!itemId) return false
  const { count } = await prisma.sound.updateMany({
    where: { id: itemId, status: { in: ['PENDING', 'PROCESSING'] } },
    data: { status: 'ERROR', processingError: soundProcessingErrorMessage(null) },
  })
  return count > 0
}
