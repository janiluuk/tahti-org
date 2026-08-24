// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { Queue, QueueEvents } from 'bullmq'
import type { EditList } from '@tahti/audio-edit'
import { config } from '../config.js'

const connection = {
  host: new URL(config.redisUrl).hostname,
  port: parseInt(new URL(config.redisUrl).port || '6379', 10),
}

// Retries give lane-filtered workers (see apps/worker/src/index.ts's --queues
// handling) a chance to land on a worker that actually handles this job name —
// without a default, a job with no explicit `attempts` gets exactly 1 try and is
// lost for good if the worker that first dequeues it isn't in the right lane.
const defaultJobOptions = { attempts: 3, backoff: { type: 'exponential' as const, delay: 5000 } }

export const mediaQueue = new Queue('media', { connection, defaultJobOptions })

// Shared listener connection for routes that await a job's result inline
// (e.g. the fingerprint check below) via `job.waitUntilFinished`, rather than
// firing-and-polling like the rest of this file's enqueue helpers.
export const mediaQueueEvents = new QueueEvents('media', { connection })

export async function enqueueTranscode(itemId: string): Promise<void> {
  await mediaQueue.add('transcode-archive', { itemId })
}

export async function enqueueVersionTranscode(versionId: string): Promise<void> {
  await mediaQueue.add('transcode-archive-version', { versionId })
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

export interface FingerprintReleaseTrackResult {
  fingerprint: string | null
  match: {
    acoustidId: string
    score: number
    recordingId?: string
    title?: string
    artist?: string
  } | null
  persisted: boolean
}

const FINGERPRINT_JOB_TIMEOUT_MS = 30_000

/** Runs a manual (re-)fingerprint for a release track and waits for the
 * worker's result — fpcalc + one AcoustID lookup for a single track is
 * seconds, not minutes, so a blocking request is simpler here than adding a
 * status-polling endpoint just for this one action. `persist: false` runs
 * the exact same check without writing `fingerprint`/`fingerprintMatch`. */
export async function runFingerprintReleaseTrack(
  trackId: string,
  persist: boolean,
): Promise<FingerprintReleaseTrackResult> {
  const job = await mediaQueue.add(
    'fingerprint-release-track',
    { trackId, persist },
    { attempts: 1 },
  )
  return (await job.waitUntilFinished(
    mediaQueueEvents,
    FINGERPRINT_JOB_TIMEOUT_MS,
  )) as FingerprintReleaseTrackResult
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
export async function enqueueCloudImportGoogleDrive(cloudImportJobId: string): Promise<void> {
  await mediaQueue.add(
    'cloud-import-google-drive',
    { cloudImportJobId },
    {
      jobId: `cloud-import-google-drive-${cloudImportJobId}`,
      attempts: 3,
      backoff: { type: 'exponential', delay: 15_000 },
    },
  )
}

export async function enqueueCloudImportSoundcloud(cloudImportJobId: string): Promise<void> {
  await mediaQueue.add(
    'cloud-import-soundcloud',
    { cloudImportJobId },
    {
      jobId: `cloud-import-soundcloud-${cloudImportJobId}`,
      attempts: 3,
      backoff: { type: 'exponential', delay: 15_000 },
    },
  )
}

export async function enqueueCloudImportHearthis(cloudImportJobId: string): Promise<void> {
  await mediaQueue.add(
    'cloud-import-hearthis',
    { cloudImportJobId },
    {
      jobId: `cloud-import-hearthis-${cloudImportJobId}`,
      attempts: 3,
      backoff: { type: 'exponential', delay: 15_000 },
    },
  )
}

export async function enqueueHearthisEmbedLocalization(payload: {
  archiveItemId: string
  trackUrl: string
}): Promise<void> {
  await mediaQueue.add('hearthis-embed-localize', payload, {
    jobId: `hearthis-embed-localize-${payload.archiveItemId}`,
    attempts: 3,
    backoff: { type: 'exponential', delay: 15_000 },
  })
}

export interface RenderAnnouncementTrimJob {
  clipId: string
  sourceKey: string
  outputKeyPrefix: string
  startSec: number
  endSec: number
  fadeInSec: number
  fadeOutSec: number
}

export async function enqueueRenderAnnouncementTrim(
  payload: RenderAnnouncementTrimJob,
): Promise<void> {
  await mediaQueue.add('render-announcement-trim', payload, {
    jobId: `render-announcement-trim-${payload.clipId}`,
    attempts: 3,
    backoff: { type: 'exponential', delay: 10_000 },
  })
}

export interface SeparateStemsJob {
  stemJobId: string
  archiveItemId: string
  sourceKey: string
  stemSet: 'TWO_STEM' | 'FOUR_STEM'
}

export async function enqueueSeparateStems(payload: SeparateStemsJob): Promise<void> {
  await mediaQueue.add('separate-stems', payload, {
    jobId: `separate-stems-${payload.stemJobId}`,
    attempts: 2,
    backoff: { type: 'exponential', delay: 15_000 },
  })
}

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

export interface OpenThemePullRequestJob {
  themeId: string
}

export async function enqueueOpenThemePullRequest(
  payload: OpenThemePullRequestJob,
): Promise<void> {
  await mediaQueue.add('open-theme-pull-request', payload, {
    jobId: `open-theme-pull-request-${payload.themeId}`,
    attempts: 3,
    backoff: { type: 'exponential', delay: 10_000 },
  })
}
