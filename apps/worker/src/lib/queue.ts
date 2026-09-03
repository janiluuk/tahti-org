// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { Queue } from 'bullmq'

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379'

const connection = {
  host: new URL(REDIS_URL).hostname,
  port: parseInt(new URL(REDIS_URL).port || '6379', 10),
}

// See apps/api/src/lib/queue.ts — same reasoning: gives lane-filtered workers a
// chance to land on the right worker instead of losing the job on first mismatch.
const defaultJobOptions = { attempts: 3, backoff: { type: 'exponential' as const, delay: 5000 } }

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
  try {
    await queue.add(
      'encode-streaming-copy',
      { itemId },
      {
        jobId: `encode-streaming-copy-${itemId}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 10_000 },
      },
    )
  } finally {
    await queue.close()
  }
}
