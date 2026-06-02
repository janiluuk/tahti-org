// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.fi>

import { Worker } from 'bullmq'
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

process.on('SIGTERM', async () => {
  await worker.close()
  await prisma.$disconnect()
  process.exit(0)
})

console.log('[worker] started, listening for jobs on media queue')
