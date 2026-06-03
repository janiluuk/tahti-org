// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import { Worker, Queue } from 'bullmq'
import { prisma } from '@tahti/db'
import { processTranscodeJob } from './jobs/transcode.js'
import { processArchiveBroadcastJob } from './jobs/archive-broadcast.js'
import { processMonthlyLedgerRollup } from './jobs/monthly-ledger-rollup.js'

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
    } else if (job.name === 'archive-broadcast') {
      await processArchiveBroadcastJob(job)
    } else if (job.name === 'monthly-ledger-rollup') {
      await processMonthlyLedgerRollup(job)
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
