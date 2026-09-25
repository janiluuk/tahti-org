// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { Worker } from 'bullmq'
import { prisma } from '@tahti/db'
import { runAnnualGrantCalc } from '@tahti/ledger'
import { processTranscodeJob } from './jobs/transcode.js'
import { processEncodeStreamingCopyJob } from './jobs/encode-streaming-copy.js'
import { processTranscodeVersionJob } from './jobs/transcode-version.js'
import { processRenderSoundEditJob } from './jobs/render-sound-edit.js'
import { processRenderAnnouncementTrimJob } from './jobs/render-announcement-trim.js'
import { processOpenThemePullRequestJob } from './jobs/open-theme-pull-request.js'
import { processSeparateStemsJob } from './jobs/separate-stems.js'
import { processSweepExpiredStemsJob } from './jobs/sweep-expired-stems.js'
import { processLiveShowRecurrenceJob } from './jobs/live-show-recurrence.js'
import { processMissedLiveShowScanJob } from './jobs/missed-live-show-scan.js'
import { processBackfillEditorPeaksJob } from './jobs/backfill-editor-peaks.js'
import { processSweepEditorPeaksBackfillJob } from './jobs/sweep-editor-peaks-backfill.js'
import { processTranscodeReleaseTrackJob } from './jobs/transcode-release-track.js'
import { processFingerprintReleaseTrackJob } from './jobs/fingerprint-release-track.js'
import { processTranscodeReleaseTrackVersionJob } from './jobs/transcode-release-track-version.js'
import { processMixcloudUploadJob } from './jobs/mixcloud-upload.js'
import { processCloudImportGoogleDriveJob } from './jobs/cloud-import-google-drive.js'
import { processSoundcloudImportJob } from './jobs/soundcloud-import.js'
import { processHearthisImportJob } from './jobs/hearthis-import.js'
import { processHearthisEmbedLocalizationJob } from './jobs/hearthis-embed-localize.js'
import { processNewsletterDispatch } from './jobs/newsletter-dispatch.js'
import { processSoundBroadcastJob } from './jobs/sound-broadcast.js'
import { processFinalizeBroadcastRecordingJob } from './jobs/finalize-broadcast-recording.js'
import { processMonthlyLedgerRollup } from './jobs/monthly-ledger-rollup.js'
import { processBroadcastCapTick, processWeeklyBroadcastReset } from './jobs/broadcast-cap.js'
import { processTahtiSelectsDrawJob } from './jobs/tahti-selects-draw.js'
import { processFanSubPayoutsJob } from './jobs/fan-sub-payout.js'
import { processFanSubExpire } from './jobs/fan-sub-expire.js'
import { processFanSubscriberPurgeJob } from './jobs/fan-subscriber-purge.js'
import { processSocialPostDispatchJob } from './jobs/social-post-dispatch.js'
import { processDownloadFraudScanJob } from './jobs/download-fraud-scan.js'
import { processTorExitListSyncJob } from './jobs/tor-exit-list-sync.js'
import { processInternetRadioNowPlayingSyncJob } from './jobs/internet-radio-now-playing-sync.js'
import {
  processMembershipLapseJob,
  processMembershipRenewalJob,
} from './jobs/membership-lifecycle.js'
import { processMentionDigestJob } from './jobs/mention-digest.js'
import { processPostPublishNotifyJob } from './jobs/post-publish-notify.js'
import { processListenSessionCloseJob } from './jobs/listen-session-close.js'
import { processRevelatorDeliverJob } from './jobs/revelator-deliver.js'
import { processHearthisExportJob } from './jobs/hearthis-export.js'
import { processRevelatorRoyaltySyncJob } from './jobs/revelator-royalty-sync.js'
import { processChannelWatchdogJob } from './jobs/channel-watchdog.js'
import { processRadioSlotSwitchoverJob } from './jobs/radio-slot-switchover.js'
import { processChannelFallbackReconcilerJob } from './jobs/channel-fallback-reconciler.js'
import { processSidecarCleanupJob } from './jobs/sidecar-cleanup.js'
import { processHlsLivePruneJob } from './jobs/hls-live-prune.js'
import { processHlsMinioSyncJob } from './jobs/hls-minio-sync.js'
import { processHlsCaddyEgressSyncJob } from './jobs/hls-caddy-egress-sync.js'
import {
  processSoundFallbackCacheSyncJob,
  processWarmSoundFallbackCacheJob,
} from './jobs/sound-fallback-cache.js'
import { runWithCronLog } from './lib/cron-run.js'
import { runCronTasks } from './lib/cron-tasks.js'
import { jobNamesForLanes } from '@tahti/shared'
import {
  registerWorker,
  heartbeat,
  recordJobEvent,
  resolveWorkerName,
  pruneStaleWorkers,
} from './lib/worker-registry.js'
import { JOB_RETENTION } from './lib/job-retention.js'

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379'

const connection = {
  host: new URL(REDIS_URL).hostname,
  port: parseInt(new URL(REDIS_URL).port || '6379', 10),
}

// --queues=media,dist — restricts this process to job names in those lanes
// (see packages/shared/src/worker-job-lanes.ts). Every container in
// infra/docker-stack.yml passes this so e.g. the 256MB worker-edge-log
// container never gets handed a 4GB ffmpeg transcode job. Omit entirely (as
// local dev / `pnpm dev` does) to process every job name, unfiltered.
const queuesArg = process.argv.find((a) => a.startsWith('--queues='))
const requestedLanes = queuesArg
  ? queuesArg
      .slice('--queues='.length)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  : []
const allowedJobNames = jobNamesForLanes(requestedLanes)
if (requestedLanes.length > 0) {
  console.log(
    `[worker] lane filter active: ${requestedLanes.join(',')} (${allowedJobNames.size} job names)`,
  )
}

const WORKER_NAME = resolveWorkerName()
const WORKER_LANES = requestedLanes.length > 0 ? requestedLanes : ['all']
const HEARTBEAT_MS = 20_000
const PRUNE_STALE_WORKERS_MS = 6 * 60 * 60 * 1000

const worker = new Worker(
  'media',
  async (job) => {
    if (allowedJobNames.size > 0 && !allowedJobNames.has(job.name)) {
      // Not our lane — throw so BullMQ retries (per the enqueuer's job options) until a
      // worker whose --queues covers this job name picks it up instead.
      throw new Error(`lane-mismatch: ${job.name} is not handled by this worker's --queues`)
    }
    return await runWithCronLog(job.name, async () => {
      if (job.name === 'transcode-sound') {
        await processTranscodeJob(job)
      } else if (job.name === 'encode-streaming-copy') {
        await processEncodeStreamingCopyJob(job)
      } else if (job.name === 'transcode-sound-version') {
        await processTranscodeVersionJob(job)
      } else if (job.name === 'render-sound-edit') {
        await processRenderSoundEditJob(job)
      } else if (job.name === 'render-announcement-trim') {
        await processRenderAnnouncementTrimJob(job)
      } else if (job.name === 'open-theme-pull-request') {
        await processOpenThemePullRequestJob(job)
      } else if (job.name === 'separate-stems') {
        await processSeparateStemsJob(job)
      } else if (job.name === 'backfill-editor-peaks') {
        await processBackfillEditorPeaksJob(job)
      } else if (job.name === 'media-daily-sweeps') {
        return await runCronTasks({
          'sweep-editor-peaks-backfill': () => processSweepEditorPeaksBackfillJob(job),
          'sweep-expired-stems': () => processSweepExpiredStemsJob(),
        })
      } else if (job.name === 'transcode-release-track') {
        await processTranscodeReleaseTrackJob(job)
      } else if (job.name === 'transcode-release-track-version') {
        await processTranscodeReleaseTrackVersionJob(job)
      } else if (job.name === 'fingerprint-release-track') {
        return await processFingerprintReleaseTrackJob(job)
      } else if (job.name === 'mixcloud-upload') {
        await processMixcloudUploadJob(job)
      } else if (job.name === 'cloud-import-google-drive') {
        await processCloudImportGoogleDriveJob(job)
      } else if (job.name === 'cloud-import-soundcloud') {
        await processSoundcloudImportJob(job)
      } else if (job.name === 'cloud-import-hearthis') {
        await processHearthisImportJob(job)
      } else if (job.name === 'hearthis-embed-localize') {
        await processHearthisEmbedLocalizationJob(job)
      } else if (job.name === 'newsletter-dispatch') {
        await processNewsletterDispatch(job)
      } else if (job.name === 'finalize-broadcast-recording') {
        await processFinalizeBroadcastRecordingJob(job)
      } else if (job.name === 'sound-broadcast') {
        await processSoundBroadcastJob(job)
      } else if (job.name === 'monthly-ledger-rollup') {
        return await processMonthlyLedgerRollup(job)
      } else if (job.name === 'media-minute-tick') {
        return await runCronTasks(
          {
            'channel-watchdog': () => processChannelWatchdogJob(prisma, job),
            'radio-slot-switchover': () => processRadioSlotSwitchoverJob(prisma, job),
            'channel-fallback-reconciler': () => processChannelFallbackReconcilerJob(prisma, job),
          },
          { parallel: true },
        )
      } else if (job.name === 'media-ten-minute-tick') {
        return await runCronTasks(
          {
            'sidecar-cleanup': () => processSidecarCleanupJob(job),
            'sound-fallback-cache-sync': () => processSoundFallbackCacheSyncJob(prisma, job),
            'hls-live-prune': () => processHlsLivePruneJob(job),
          },
          { parallel: true },
        )
      } else if (job.name === 'hls-minio-sync') {
        const summary = await processHlsMinioSyncJob(prisma, job)
        if (summary.uploaded > 0) {
          console.debug('[worker] hls-minio-sync:', JSON.stringify(summary))
        }
        return summary
      } else if (job.name === 'hls-caddy-egress-sync') {
        const summary = await processHlsCaddyEgressSyncJob(job)
        if (summary.lines > 0) {
          console.log('[worker] hls-caddy-egress-sync:', JSON.stringify(summary))
        }
        return summary
      } else if (job.name === 'warm-sound-fallback-cache') {
        const summary = await processWarmSoundFallbackCacheJob(prisma, job)
        if (summary.downloaded > 0) {
          console.log('[worker] warm-sound-fallback-cache:', JSON.stringify(summary))
        }
      } else if (job.name === 'light-minute-tick') {
        return await runCronTasks(
          {
            'broadcast-cap-tick': () => processBroadcastCapTick(prisma),
            'post-publish-notify': () => processPostPublishNotifyJob(job),
          },
          { parallel: true },
        )
      } else if (job.name === 'weekly-monday') {
        return await runCronTasks({
          'weekly-broadcast-reset': () => processWeeklyBroadcastReset(prisma),
          'tahti-selects-weekly-draw': () => processTahtiSelectsDrawJob(prisma),
        })
      } else if (job.name === 'fan-sub-daily') {
        return await runCronTasks({
          'fan-sub-payout': () => processFanSubPayoutsJob(prisma),
          'fan-sub-expire': () => processFanSubExpire(prisma),
          'fan-subscriber-purge': () => processFanSubscriberPurgeJob(prisma),
        })
      } else if (job.name === 'social-post-dispatch') {
        const { postId } = job.data as { postId: string }
        await processSocialPostDispatchJob(prisma, postId)
      } else if (job.name === 'internet-radio-now-playing-sync') {
        return await processInternetRadioNowPlayingSyncJob(job)
      } else if (job.name === 'membership-daily') {
        return await runCronTasks({
          'membership-renewal-reminder': () => processMembershipRenewalJob(job),
          'membership-lapse': () => processMembershipLapseJob(job),
        })
      } else if (job.name === 'mention-digest') {
        return await processMentionDigestJob(job)
      } else if (job.name === 'listen-session-close') {
        return await processListenSessionCloseJob(job)
      } else if (job.name === 'revelator-deliver') {
        await processRevelatorDeliverJob(job)
      } else if (job.name === 'hearthis-export') {
        await processHearthisExportJob(job)
      } else if (job.name === 'revelator-royalty-sync') {
        const summary = await processRevelatorRoyaltySyncJob(prisma, job)
        console.log('[worker] revelator-royalty-sync:', JSON.stringify(summary))
        return summary
      } else if (job.name === 'light-daily') {
        return await runCronTasks({
          'tor-exit-list-sync': () => processTorExitListSyncJob(job),
          'download-fraud-scan': () => processDownloadFraudScanJob(job),
          'live-show-recurrence-generate': () => processLiveShowRecurrenceJob(job),
        })
      } else if (job.name === 'missed-live-show-scan') {
        const summary = await processMissedLiveShowScanJob(job)
        if (summary.flagged > 0 || summary.autoResolved > 0) {
          console.log('[worker] missed-live-show-scan:', JSON.stringify(summary))
        }
        return summary
      } else if (job.name === 'annual-grant-calc') {
        // Default to the prior calendar year (matches Finnish fiscal year).
        const { year } = job.data as { year?: number }
        const forYear = year ?? new Date().getUTCFullYear() - 1
        const summary = await runAnnualGrantCalc(prisma, forYear)
        console.log(`[worker] annual-grant-calc ${forYear}:`, JSON.stringify(summary))
        return summary
      } else {
        console.log(`[worker] unknown job ${job.name}, skipping`)
      }
    })
  },
  // Explicit and per-container-tunable rather than silently defaulting to
  // BullMQ's factory concurrency of 1 — set WORKER_CONCURRENCY to match each
  // container's actual CPU/memory allocation in infra/docker-stack.yml.
  {
    connection,
    concurrency: parseInt(process.env.WORKER_CONCURRENCY ?? '1', 10),
    // Repeatable (cron) ticks don't carry removeOnComplete/removeOnFail in their
    // stored job options even when registerCrons passes them; this Worker-level
    // fallback is what bounds bull:media:completed/failed for them.
    ...JOB_RETENTION,
  },
)

worker.on('active', (job) => {
  void recordJobEvent(WORKER_NAME, {
    jobId: String(job.id),
    jobName: job.name,
    status: 'active',
    at: Date.now(),
  })
})

worker.on('completed', (job) => {
  console.log(`[worker] job ${job.id} (${job.name}) completed`)
  void recordJobEvent(WORKER_NAME, {
    jobId: String(job.id),
    jobName: job.name,
    status: 'completed',
    at: Date.now(),
  })
})

worker.on('failed', (job, err) => {
  console.error(`[worker] job ${job?.id} (${job?.name}) failed:`, err)
  if (job) {
    void recordJobEvent(WORKER_NAME, {
      jobId: String(job.id),
      jobName: job.name,
      status: 'failed',
      at: Date.now(),
      errorMessage: err.message,
    })
  }
})

// A stray error anywhere outside the guarded job-processing path above (e.g. a
// timer, or an awaited call whose rejection escapes) would otherwise crash the
// whole process silently, halting every queue until something restarts it.
process.on('unhandledRejection', (reason) => {
  console.error('[worker] unhandledRejection:', reason)
})
process.on('uncaughtException', (err) => {
  console.error('[worker] uncaughtException:', err)
})

registerWorker(WORKER_NAME, WORKER_LANES).catch((err: unknown) => {
  console.error('[worker] failed to register with worker registry:', err)
})
const heartbeatInterval = setInterval(() => {
  void heartbeat(WORKER_NAME)
}, HEARTBEAT_MS)
const pruneStaleWorkersInterval = setInterval(() => {
  void pruneStaleWorkers().catch((err: unknown) => {
    console.error('[worker] failed to prune stale worker-registry entries:', err)
  })
}, PRUNE_STALE_WORKERS_MS)

process.on('SIGTERM', async () => {
  clearInterval(heartbeatInterval)
  clearInterval(pruneStaleWorkersInterval)
  await worker.close()
  await prisma.$disconnect()
  process.exit(0)
})

console.log(`[worker] started as "${WORKER_NAME}", listening for jobs on media queue`)
