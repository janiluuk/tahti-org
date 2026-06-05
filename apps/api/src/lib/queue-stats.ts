// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { mediaQueue } from './queue.js'

const TRACKED_JOB_NAMES = [
  'newsletter-dispatch',
  'transcode-release-track',
  'mixcloud-upload',
  'fan-sub-payout',
  'fan-sub-expire',
  'download-fraud-scan',
] as const

export interface QueueJobStats {
  name: string
  waiting: number
  active: number
  delayed: number
  failed: number
}

function countByName(jobs: { name: string }[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const job of jobs) {
    map.set(job.name, (map.get(job.name) ?? 0) + 1)
  }
  return map
}

/** BullMQ waiting/active counts grouped by job name (admin dashboard). */
export async function getQueueStatsByJobName(): Promise<QueueJobStats[]> {
  const totals = await mediaQueue.getJobCounts('waiting', 'active', 'delayed', 'failed')
  const [waitingJobs, activeJobs, delayedJobs, failedJobs] = await Promise.all([
    mediaQueue.getJobs(['waiting'], 0, 500),
    mediaQueue.getJobs(['active'], 0, 200),
    mediaQueue.getJobs(['delayed'], 0, 200),
    mediaQueue.getJobs(['failed'], 0, 200),
  ])

  const waiting = countByName(waitingJobs)
  const active = countByName(activeJobs)
  const delayed = countByName(delayedJobs)
  const failed = countByName(failedJobs)

  const stats: QueueJobStats[] = TRACKED_JOB_NAMES.map((name) => ({
    name,
    waiting: waiting.get(name) ?? 0,
    active: active.get(name) ?? 0,
    delayed: delayed.get(name) ?? 0,
    failed: failed.get(name) ?? 0,
  }))

  stats.push({
    name: '_queue_total',
    waiting: totals.waiting ?? 0,
    active: totals.active ?? 0,
    delayed: totals.delayed ?? 0,
    failed: totals.failed ?? 0,
  })

  return stats
}
