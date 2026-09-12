// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { Queue } from 'bullmq'
import { WORKER_CRON_JOBS } from '@tahti/shared'

function redisConnection() {
  const redisUrl = new URL(process.env.REDIS_URL ?? 'redis://localhost:6379')
  return {
    host: redisUrl.hostname,
    port: parseInt(redisUrl.port || '6379', 10),
  }
}

const defaultJobOptions = { attempts: 3, backoff: { type: 'exponential' as const, delay: 5000 } }

/** Make the manifest in Redis exactly match WORKER_CRON_JOBS. This is owned by
 * the single cron-runner stack service so worker replicas never race while
 * deleting and recreating repeatable schedules. */
export async function registerCrons(): Promise<number> {
  const queue = new Queue('media', { connection: redisConnection(), defaultJobOptions })
  const hasCaddyLog = Boolean(process.env.CADDY_HLS_ACCESS_LOG)

  try {
    for (const previous of await queue.getRepeatableJobs()) {
      await queue.removeRepeatableByKey(previous.key)
    }

    let registered = 0
    for (const job of WORKER_CRON_JOBS) {
      if (job.name === 'hls-caddy-egress-sync' && !hasCaddyLog) continue
      const repeat = job.everyMs != null ? { every: job.everyMs } : { pattern: job.pattern! }
      await queue.add(job.name, {}, { repeat, jobId: job.jobId })
      registered++
    }
    return registered
  } finally {
    await queue.close()
  }
}
