// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { Queue } from 'bullmq'
import { config } from '../config.js'

const connection = {
  host: new URL(config.redisUrl).hostname,
  port: parseInt(new URL(config.redisUrl).port || '6379', 10),
}

export const mediaQueue = new Queue('media', { connection })

export async function enqueueTranscode(itemId: string): Promise<void> {
  await mediaQueue.add('transcode-archive', { itemId })
}

export async function enqueueVersionTranscode(versionId: string): Promise<void> {
  await mediaQueue.add('transcode-archive-version', { versionId })
}

export async function enqueueReleaseTrackVersionTranscode(versionId: string): Promise<void> {
  await mediaQueue.add('transcode-release-track-version', { versionId })
}

/** ARTIST-001: scan Liquidsoap WAV on shared volume, upload to MinIO, then archive. */
export async function enqueueFinalizeBroadcastRecording(broadcastId: string): Promise<void> {
  await mediaQueue.add(
    'finalize-broadcast-recording',
    { broadcastId },
    {
      jobId: `finalize-broadcast-${broadcastId}`,
      attempts: 5,
      backoff: { type: 'exponential', delay: 15_000 },
    },
  )
}

/** STREAM-009: mirror fallback pool to local disk for Liquidsoap. */
export async function enqueueWarmArchiveFallbackCache(channelId: string): Promise<void> {
  await mediaQueue.add(
    'warm-archive-fallback-cache',
    { channelId },
    {
      jobId: `warm-archive-fallback-cache-${channelId}`,
      removeOnComplete: true,
      removeOnFail: 100,
    },
  )
}
