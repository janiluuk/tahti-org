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

export async function enqueueArchiveBroadcast(broadcastId: string): Promise<void> {
  const queue = new Queue('media', { connection, defaultJobOptions })
  try {
    await queue.add(
      'archive-broadcast',
      { broadcastId },
      { jobId: `archive-broadcast-${broadcastId}`, delay: 3000 },
    )
  } finally {
    await queue.close()
  }
}

export async function enqueueWarmArchiveFallbackCache(channelId: string): Promise<void> {
  const queue = new Queue('media', { connection, defaultJobOptions })
  try {
    await queue.add(
      'warm-archive-fallback-cache',
      { channelId },
      {
        jobId: `warm-archive-fallback-cache-${channelId}`,
        removeOnComplete: true,
        removeOnFail: 100,
      },
    )
  } finally {
    await queue.close()
  }
}

export async function enqueueTranscodeArchive(itemId: string): Promise<void> {
  const queue = new Queue('media', { connection, defaultJobOptions })
  try {
    await queue.add('transcode-archive', { itemId })
  } finally {
    await queue.close()
  }
}
