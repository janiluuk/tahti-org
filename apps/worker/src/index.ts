// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { Worker, Queue } from 'bullmq'
import { prisma } from '@tahti/db'
import { runAnnualGrantCalc } from '@tahti/ledger'
import { processTranscodeJob } from './jobs/transcode.js'
import { processTranscodeVersionJob } from './jobs/transcode-version.js'
import { processBounceArchiveEditJob } from './jobs/bounce-archive-edit.js'
import { processRenderArchiveEditJob } from './jobs/render-archive-edit.js'
import { processTranscodeReleaseTrackJob } from './jobs/transcode-release-track.js'
import { processTranscodeReleaseTrackVersionJob } from './jobs/transcode-release-track-version.js'
import { processMixcloudUploadJob } from './jobs/mixcloud-upload.js'
import { processNewsletterDispatch } from './jobs/newsletter-dispatch.js'
import { processArchiveBroadcastJob } from './jobs/archive-broadcast.js'
import { processFinalizeBroadcastRecordingJob } from './jobs/finalize-broadcast-recording.js'
import { processMonthlyLedgerRollup } from './jobs/monthly-ledger-rollup.js'
import { processBroadcastCapTick, processWeeklyBroadcastReset } from './jobs/broadcast-cap.js'
import { processFanSubPayoutsJob } from './jobs/fan-sub-payout.js'
import { processFanSubExpire } from './jobs/fan-sub-expire.js'
import { processFanSubscriberPurgeJob } from './jobs/fan-subscriber-purge.js'
import { processSocialPostDispatchJob } from './jobs/social-post-dispatch.js'
import { processDownloadFraudScanJob } from './jobs/download-fraud-scan.js'
import { processTorExitListSyncJob } from './jobs/tor-exit-list-sync.js'
import {
  processMembershipLapseJob,
  processMembershipRenewalJob,
} from './jobs/membership-lifecycle.js'
import { processMentionDigestJob } from './jobs/mention-digest.js'
import { processRevelatorDeliverJob } from './jobs/revelator-deliver.js'
import { processRevelatorRoyaltySyncJob } from './jobs/revelator-royalty-sync.js'
import { processChannelWatchdogJob } from './jobs/channel-watchdog.js'
import { processHlsMinioSyncJob } from './jobs/hls-minio-sync.js'
import { processHlsCaddyEgressSyncJob } from './jobs/hls-caddy-egress-sync.js'
import {
  processArchiveFallbackCacheSyncJob,
  processWarmArchiveFallbackCacheJob,
} from './jobs/archive-fallback-cache.js'
import { WORKER_CRON_JOBS } from './cron-manifest.js'
import { runWithCronLog } from './lib/cron-run.js'

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379'

const connection = {
  host: new URL(REDIS_URL).hostname,
  port: parseInt(new URL(REDIS_URL).port || '6379', 10),
}

const worker = new Worker(
  'media',
  async (job) => {
    await runWithCronLog(job.name, async () => {
      if (job.name === 'transcode-archive') {
        await processTranscodeJob(job)
      } else if (job.name === 'transcode-archive-version') {
        await processTranscodeVersionJob(job)
      } else if (job.name === 'bounce-archive-edit') {
        await processBounceArchiveEditJob(job)
      } else if (job.name === 'render-archive-edit') {
        await processRenderArchiveEditJob(job)
      } else if (job.name === 'transcode-release-track') {
        await processTranscodeReleaseTrackJob(job)
      } else if (job.name === 'transcode-release-track-version') {
        await processTranscodeReleaseTrackVersionJob(job)
      } else if (job.name === 'mixcloud-upload') {
        await processMixcloudUploadJob(job)
      } else if (job.name === 'newsletter-dispatch') {
        await processNewsletterDispatch(job)
      } else if (job.name === 'finalize-broadcast-recording') {
        await processFinalizeBroadcastRecordingJob(job)
      } else if (job.name === 'archive-broadcast') {
        await processArchiveBroadcastJob(job)
      } else if (job.name === 'monthly-ledger-rollup') {
        await processMonthlyLedgerRollup(job)
      } else if (job.name === 'channel-watchdog') {
        const summary = await processChannelWatchdogJob(prisma, job)
        console.log('[worker] channel-watchdog:', JSON.stringify(summary))
      } else if (job.name === 'hls-minio-sync') {
        const summary = await processHlsMinioSyncJob(prisma, job)
        if (summary.uploaded > 0) {
          console.log('[worker] hls-minio-sync:', JSON.stringify(summary))
        }
      } else if (job.name === 'hls-caddy-egress-sync') {
        const summary = await processHlsCaddyEgressSyncJob(job)
        if (summary.lines > 0) {
          console.log('[worker] hls-caddy-egress-sync:', JSON.stringify(summary))
        }
      } else if (job.name === 'warm-archive-fallback-cache') {
        const summary = await processWarmArchiveFallbackCacheJob(prisma, job)
        if (summary.downloaded > 0) {
          console.log('[worker] warm-archive-fallback-cache:', JSON.stringify(summary))
        }
      } else if (job.name === 'archive-fallback-cache-sync') {
        await processArchiveFallbackCacheSyncJob(prisma, job)
      } else if (job.name === 'broadcast-cap-tick') {
        const summary = await processBroadcastCapTick(prisma)
        console.log('[worker] broadcast-cap-tick:', JSON.stringify(summary))
      } else if (job.name === 'weekly-broadcast-reset') {
        const summary = await processWeeklyBroadcastReset(prisma)
        console.log('[worker] weekly-broadcast-reset:', JSON.stringify(summary))
      } else if (job.name === 'fan-sub-payout') {
        const summary = await processFanSubPayoutsJob(prisma)
        console.log('[worker] fan-sub-payout:', JSON.stringify(summary))
      } else if (job.name === 'fan-sub-expire') {
        const summary = await processFanSubExpire(prisma)
        console.log('[worker] fan-sub-expire:', JSON.stringify(summary))
      } else if (job.name === 'fan-subscriber-purge') {
        const summary = await processFanSubscriberPurgeJob(prisma)
        if (summary.canceled > 0) {
          console.log('[worker] fan-subscriber-purge:', JSON.stringify(summary))
        }
      } else if (job.name === 'social-post-dispatch') {
        const { postId } = job.data as { postId: string }
        await processSocialPostDispatchJob(prisma, postId)
      } else if (job.name === 'tor-exit-list-sync') {
        await processTorExitListSyncJob(job)
      } else if (job.name === 'download-fraud-scan') {
        await processDownloadFraudScanJob(job)
      } else if (job.name === 'membership-renewal-reminder') {
        await processMembershipRenewalJob(job)
      } else if (job.name === 'membership-lapse') {
        await processMembershipLapseJob(job)
      } else if (job.name === 'mention-digest') {
        await processMentionDigestJob(job)
      } else if (job.name === 'revelator-deliver') {
        await processRevelatorDeliverJob(job)
      } else if (job.name === 'revelator-royalty-sync') {
        const summary = await processRevelatorRoyaltySyncJob(prisma, job)
        console.log('[worker] revelator-royalty-sync:', JSON.stringify(summary))
      } else if (job.name === 'annual-grant-calc') {
        // Default to the prior calendar year (matches Finnish fiscal year).
        const { year } = job.data as { year?: number }
        const forYear = year ?? new Date().getUTCFullYear() - 1
        const summary = await runAnnualGrantCalc(prisma, forYear)
        console.log(`[worker] annual-grant-calc ${forYear}:`, JSON.stringify(summary))
      } else {
        console.log(`[worker] unknown job ${job.name}, skipping`)
      }
    })
  },
  { connection },
)

worker.on('completed', (job) => {
  console.log(`[worker] job ${job.id} (${job.name}) completed`)
})

worker.on('failed', (job, err) => {
  console.error(`[worker] job ${job?.id} (${job?.name}) failed:`, err)
})

// Register repeatable cron jobs — idempotent (BullMQ deduplicates by key)
async function registerCrons() {
  const queue = new Queue('media', { connection })
  const hasCaddyLog = Boolean(process.env.CADDY_HLS_ACCESS_LOG)

  for (const job of WORKER_CRON_JOBS) {
    if (job.name === 'hls-caddy-egress-sync' && !hasCaddyLog) continue
    await queue.add(job.name, {}, { repeat: { pattern: job.pattern }, jobId: job.jobId })
  }

  await queue.close()
  console.log(`[worker] ${WORKER_CRON_JOBS.length} cron jobs registered`)
}

registerCrons().catch((err: unknown) => {
  console.error('[worker] failed to register crons:', err)
})

process.on('SIGTERM', async () => {
  await worker.close()
  await prisma.$disconnect()
  process.exit(0)
})

console.log('[worker] started, listening for jobs on media queue')
