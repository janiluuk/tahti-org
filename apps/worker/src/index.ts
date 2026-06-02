// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.fi>

import { Worker } from 'bullmq'
import { prisma } from '@tahti/db'

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379'

const connection = {
  host: new URL(REDIS_URL).hostname,
  port: parseInt(new URL(REDIS_URL).port ?? '6379', 10),
}

// Placeholder worker — M2/M3 will add real job processors here
const worker = new Worker(
  'media',
  async (job) => {
    console.log(`[worker] processing job ${job.id} (${job.name})`)
  },
  { connection },
)

worker.on('completed', (job) => {
  console.log(`[worker] job ${job.id} completed`)
})

worker.on('failed', (job, err) => {
  console.error(`[worker] job ${job?.id} failed:`, err)
})

process.on('SIGTERM', async () => {
  await worker.close()
  await prisma.$disconnect()
  process.exit(0)
})

console.log('[worker] started, listening for jobs on media queue')
