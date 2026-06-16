// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { Queue } from 'bullmq'
import type { EditList } from '@tahti/audio-edit'
import type { EqBands, LufsTarget } from '@tahti/shared'
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

export interface BounceArchiveEditJob {
  versionId: string
  archiveItemId: string
  channelSlug: string
  sourceKey: string
  startSec: number
  endSec: number
  fadeInSec: number
  fadeOutSec: number
  peakNormalize: boolean
  lufsTarget: LufsTarget
  limiterEnabled: boolean
  highPassHz: number
  lowPassHz: number
  eq: EqBands
  compressorEnabled: boolean
  activate: boolean
}

export async function enqueueBounceArchiveEdit(payload: BounceArchiveEditJob): Promise<void> {
  await mediaQueue.add('bounce-archive-edit', payload, {
    jobId: `bounce-archive-edit-${payload.versionId}`,
    attempts: 3,
    backoff: { type: 'exponential', delay: 10_000 },
  })
}

export interface RenderArchiveEditJob {
  versionId: string
  archiveItemId: string
  channelSlug: string
  sourceKey: string
  editList: EditList
  format: 'flac' | 'mp3' | 'wav'
  activate: boolean
  maxDurationSec?: number
  sampleOnly?: boolean
}

export async function enqueueRenderArchiveEdit(payload: RenderArchiveEditJob): Promise<void> {
  await mediaQueue.add('render-archive-edit', payload, {
    jobId: `render-archive-edit-${payload.versionId}`,
    attempts: 3,
    backoff: { type: 'exponential', delay: 10_000 },
  })
}

export async function enqueueBackfillEditorPeaks(itemId: string): Promise<void> {
  await mediaQueue.add(
    'backfill-editor-peaks',
    { itemId },
    {
      jobId: `backfill-editor-peaks-${itemId}`,
      removeOnComplete: true,
      removeOnFail: 50,
    },
  )
}

export async function getMediaJob(jobId: string) {
  return mediaQueue.getJob(jobId)
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
