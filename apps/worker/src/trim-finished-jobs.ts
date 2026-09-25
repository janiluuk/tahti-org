// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/**
 * One-off: batch-delete old finished job records from the `media` queue.
 * Run before deploying a worker that trims by count to a large backlog.
 *
 *   node dist/trim-finished-jobs.js
 */
import { Queue } from 'bullmq'
import { trimFinishedJobs } from './lib/trim-finished-jobs.js'

const redisUrl = new URL(process.env.REDIS_URL ?? 'redis://localhost:6379')
const queue = new Queue('media', {
  connection: { host: redisUrl.hostname, port: parseInt(redisUrl.port || '6379', 10) },
})

let lastLogged = 0
const totals = await trimFinishedJobs(queue, {
  graceMs: parseInt(process.env.TRIM_GRACE_MS ?? String(60 * 60 * 1000), 10),
  batchSize: parseInt(process.env.TRIM_BATCH ?? '2000', 10),
  pauseMs: parseInt(process.env.TRIM_PAUSE_MS ?? '200', 10),
  onProgress: (type, removed) => {
    if (removed - lastLogged >= 50_000) {
      lastLogged = removed
      console.log(`[trim-finished-jobs] ${type}: removed ${removed}`)
    }
  },
})
console.log(`[trim-finished-jobs] done: ${JSON.stringify(totals)}`)
await queue.close()
