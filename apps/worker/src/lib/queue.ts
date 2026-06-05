// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { Queue } from 'bullmq'

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379'

const connection = {
  host: new URL(REDIS_URL).hostname,
  port: parseInt(new URL(REDIS_URL).port || '6379', 10),
}

export async function enqueueArchiveBroadcast(broadcastId: string): Promise<void> {
  const queue = new Queue('media', { connection })
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
  const queue = new Queue('media', { connection })
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
