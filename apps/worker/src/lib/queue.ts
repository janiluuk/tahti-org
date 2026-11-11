// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { Queue } from 'bullmq'
import { clearFinishedJob } from '@tahti/shared'
import { JOB_RETENTION } from './job-retention.js'

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379'

const connection = {
  host: new URL(REDIS_URL).hostname,
  port: parseInt(new URL(REDIS_URL).port || '6379', 10),
}

// Same defaults as apps/api/src/lib/queue.ts.
const defaultJobOptions = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 5000 },
  ...JOB_RETENTION,
}

export async function enqueueSoundBroadcast(broadcastId: string): Promise<void> {
  const queue = new Queue('media', { connection, defaultJobOptions })
  try {
    await queue.add(
      'sound-broadcast',
      { broadcastId },
      { jobId: `sound-broadcast-${broadcastId}`, delay: 3000 },
    )
  } finally {
    await queue.close()
  }
}

/** Same job and id as apps/api/src/lib/queue.ts's helper, so either side enqueues it once. */
export async function enqueueFinalizeBroadcastRecording(broadcastId: string): Promise<void> {
  const queue = new Queue('media', { connection, defaultJobOptions })
  try {
    await queue.add(
      'finalize-broadcast-recording',
      { broadcastId },
      {
        jobId: `finalize-broadcast-${broadcastId}`,
        attempts: 5,
        backoff: { type: 'exponential', delay: 15_000 },
      },
    )
  } finally {
    await queue.close()
  }
}

export async function enqueueWarmSoundFallbackCache(channelId: string): Promise<void> {
  const queue = new Queue('media', { connection, defaultJobOptions })
  try {
    await queue.add(
      'warm-sound-fallback-cache',
      { channelId },
      {
        jobId: `warm-sound-fallback-cache-${channelId}`,
        removeOnComplete: true,
        removeOnFail: 100,
      },
    )
  } finally {
    await queue.close()
  }
}

export async function enqueueTranscodeSound(itemId: string): Promise<void> {
  const queue = new Queue('media', { connection, defaultJobOptions })
  try {
    await queue.add('transcode-sound', { itemId })
  } finally {
    await queue.close()
  }
}

/** Compressed streaming copy for a lossless upload — see StreamingCopyStatus
 * on Sound and apps/api/src/lib/queue.ts's copy of this same helper
 * (the worker enqueues its own follow-up jobs without depending on apps/api). */
export async function enqueueEncodeStreamingCopy(itemId: string): Promise<void> {
  const queue = new Queue('media', { connection, defaultJobOptions })
  const jobId = `encode-streaming-copy-${itemId}`
  try {
    await clearFinishedJob(queue, jobId)
    await queue.add(
      'encode-streaming-copy',
      { itemId },
      {
        jobId,
        attempts: 3,
        backoff: { type: 'exponential', delay: 10_000 },
      },
    )
  } finally {
    await queue.close()
  }
}
