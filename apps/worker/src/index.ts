// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { Worker, Queue } from 'bullmq'
import { prisma } from '@tahti/db'
import { runAnnualGrantCalc } from '@tahti/ledger'
import { processTranscodeJob } from './jobs/transcode.js'
import { processTranscodeVersionJob } from './jobs/transcode-version.js'
import { processTranscodeReleaseTrackJob } from './jobs/transcode-release-track.js'
import { processTranscodeReleaseTrackVersionJob } from './jobs/transcode-release-track-version.js'
import { processMixcloudUploadJob } from './jobs/mixcloud-upload.js'
import { processNewsletterDispatch } from './jobs/newsletter-dispatch.js'
import { processArchiveBroadcastJob } from './jobs/archive-broadcast.js'
import { processMonthlyLedgerRollup } from './jobs/monthly-ledger-rollup.js'
import { processBroadcastCapTick, processWeeklyBroadcastReset } from './jobs/broadcast-cap.js'
import { processFanSubPayoutsJob } from './jobs/fan-sub-payout.js'
import { processFanSubExpire } from './jobs/fan-sub-expire.js'
import { processDownloadFraudScanJob } from './jobs/download-fraud-scan.js'
import { processTorExitListSyncJob } from './jobs/tor-exit-list-sync.js'
import {
  processMembershipLapseJob,
  processMembershipRenewalJob,
} from './jobs/membership-lifecycle.js'
import { processRevelatorDeliverJob } from './jobs/revelator-deliver.js'

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379'

const connection = {
  host: new URL(REDIS_URL).hostname,
  port: parseInt(new URL(REDIS_URL).port || '6379', 10),
}

const worker = new Worker(
  'media',
  async (job) => {
    if (job.name === 'transcode-archive') {
      await processTranscodeJob(job)
    } else if (job.name === 'transcode-archive-version') {
      await processTranscodeVersionJob(job)
    } else if (job.name === 'transcode-release-track') {
      await processTranscodeReleaseTrackJob(job)
    } else if (job.name === 'transcode-release-track-version') {
      await processTranscodeReleaseTrackVersionJob(job)
    } else if (job.name === 'mixcloud-upload') {
      await processMixcloudUploadJob(job)
    } else if (job.name === 'newsletter-dispatch') {
      await processNewsletterDispatch(job)
    } else if (job.name === 'archive-broadcast') {
      await processArchiveBroadcastJob(job)
    } else if (job.name === 'monthly-ledger-rollup') {
      await processMonthlyLedgerRollup(job)
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
    } else if (job.name === 'tor-exit-list-sync') {
      await processTorExitListSyncJob(job)
    } else if (job.name === 'download-fraud-scan') {
      await processDownloadFraudScanJob(job)
    } else if (job.name === 'membership-renewal-reminder') {
      await processMembershipRenewalJob(job)
    } else if (job.name === 'membership-lapse') {
      await processMembershipLapseJob(job)
    } else if (job.name === 'revelator-deliver') {
      await processRevelatorDeliverJob(job)
    } else if (job.name === 'annual-grant-calc') {
      // Default to the prior calendar year (matches Finnish fiscal year).
      const { year } = job.data as { year?: number }
      const forYear = year ?? new Date().getUTCFullYear() - 1
      const summary = await runAnnualGrantCalc(prisma, forYear)
      console.log(`[worker] annual-grant-calc ${forYear}:`, JSON.stringify(summary))
    } else {
      console.log(`[worker] unknown job ${job.name}, skipping`)
    }
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

  // Monthly ledger rollup: runs at 02:00 on the 2nd of every month
  await queue.add(
    'monthly-ledger-rollup',
    {},
    { repeat: { pattern: '0 2 2 * *' }, jobId: 'monthly-ledger-rollup-cron' },
  )

  // Annual grant calculation: 03:00 on March 1 for the prior fiscal year
  await queue.add(
    'annual-grant-calc',
    {},
    { repeat: { pattern: '0 3 1 3 *' }, jobId: 'annual-grant-calc-cron' },
  )

  // M20: increment free-tier live seconds every minute; disconnect at cap
  await queue.add(
    'broadcast-cap-tick',
    {},
    { repeat: { pattern: '* * * * *' }, jobId: 'broadcast-cap-tick-cron' },
  )

  // M20: reset free-tier weekly counters Monday 00:00 UTC
  await queue.add(
    'weekly-broadcast-reset',
    {},
    { repeat: { pattern: '0 0 * * 1' }, jobId: 'weekly-broadcast-reset-cron' },
  )

  // M19: settle fan-sub payouts (Connect destination charges) daily at 04:00 UTC
  await queue.add(
    'fan-sub-payout',
    {},
    { repeat: { pattern: '0 4 * * *' }, jobId: 'fan-sub-payout-cron' },
  )

  // M19: expire lapsed fan subscriptions daily at 05:00 UTC
  await queue.add(
    'fan-sub-expire',
    {},
    { repeat: { pattern: '0 5 * * *' }, jobId: 'fan-sub-expire-cron' },
  )

  // M18: refresh Tor exit list in Redis (05:30 UTC, before fraud scan)
  await queue.add(
    'tor-exit-list-sync',
    {},
    { repeat: { pattern: '30 5 * * *' }, jobId: 'tor-exit-list-sync-cron' },
  )

  // M18: flag suspicious download spikes for board review (06:00 UTC)
  await queue.add(
    'download-fraud-scan',
    {},
    { repeat: { pattern: '0 6 * * *' }, jobId: 'download-fraud-scan-cron' },
  )

  // M1: renewal reminder emails ~30 days before annual membership expires (07:00 UTC)
  await queue.add(
    'membership-renewal-reminder',
    {},
    { repeat: { pattern: '0 7 * * *' }, jobId: 'membership-renewal-reminder-cron' },
  )

  // M1: lapse memberships past 365 days without renewal (08:00 UTC)
  await queue.add(
    'membership-lapse',
    {},
    { repeat: { pattern: '0 8 * * *' }, jobId: 'membership-lapse-cron' },
  )

  await queue.close()
  console.log('[worker] cron jobs registered')
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
