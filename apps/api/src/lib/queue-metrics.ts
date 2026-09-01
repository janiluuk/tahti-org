// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { ALL_WORKER_LANES, WORKER_JOB_LANES, type WorkerLane } from '@tahti/shared'
import { mediaQueue } from './queue.js'

// Jobs list capped well above realistic queue depth for this fleet — bounds
// the getJobs() scan cost since BullMQ has no native "count by job name"
// query, only count-by-state (used for the *Total fields below).
const LANE_SCAN_LIMIT = 500

export interface QueueMetricSnapshot {
  waitingTotal: number
  activeTotal: number
  delayedTotal: number
  failedTotal: number
  byLane: Record<WorkerLane, { waiting: number; active: number }>
}

function laneForJobName(name: string): WorkerLane | null {
  for (const lane of ALL_WORKER_LANES) {
    if ((WORKER_JOB_LANES[lane] as readonly string[]).includes(name)) return lane
  }
  return null
}

/** All worker lanes share one BullMQ queue ("media") and filter by job name
 * client-side (see apps/worker/src/index.ts) — so per-lane depth means
 * scanning waiting/active jobs and bucketing by name, not separate queues. */
export async function collectQueueMetrics(): Promise<QueueMetricSnapshot> {
  const byLane = Object.fromEntries(
    ALL_WORKER_LANES.map((lane) => [lane, { waiting: 0, active: 0 }]),
  ) as Record<WorkerLane, { waiting: number; active: number }>

  const [counts, waitingJobs, activeJobs] = await Promise.all([
    mediaQueue.getJobCounts('waiting', 'active', 'delayed', 'failed'),
    mediaQueue.getJobs(['waiting'], 0, LANE_SCAN_LIMIT - 1),
    mediaQueue.getJobs(['active'], 0, LANE_SCAN_LIMIT - 1),
  ])

  for (const job of waitingJobs) {
    const lane = laneForJobName(job.name)
    if (lane) byLane[lane].waiting++
  }
  for (const job of activeJobs) {
    const lane = laneForJobName(job.name)
    if (lane) byLane[lane].active++
  }

  return {
    waitingTotal: counts.waiting ?? 0,
    activeTotal: counts.active ?? 0,
    delayedTotal: counts.delayed ?? 0,
    failedTotal: counts.failed ?? 0,
    byLane,
  }
}

export function renderQueueMetricLines(snapshot: QueueMetricSnapshot): string[] {
  const lines = [
    '# HELP tahti_queue_jobs Jobs in the shared BullMQ media queue by state.',
    '# TYPE tahti_queue_jobs gauge',
    `tahti_queue_jobs{state="waiting"} ${snapshot.waitingTotal}`,
    `tahti_queue_jobs{state="active"} ${snapshot.activeTotal}`,
    `tahti_queue_jobs{state="delayed"} ${snapshot.delayedTotal}`,
    `tahti_queue_jobs{state="failed"} ${snapshot.failedTotal}`,
    '# HELP tahti_queue_jobs_by_lane Jobs in the shared BullMQ queue by worker lane and state.',
    '# TYPE tahti_queue_jobs_by_lane gauge',
  ]
  for (const lane of ALL_WORKER_LANES) {
    const { waiting, active } = snapshot.byLane[lane]
    lines.push(`tahti_queue_jobs_by_lane{lane="${lane}",state="waiting"} ${waiting}`)
    lines.push(`tahti_queue_jobs_by_lane{lane="${lane}",state="active"} ${active}`)
  }
  return lines
}
