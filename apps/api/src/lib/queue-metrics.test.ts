// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { collectQueueMetrics, renderQueueMetricLines } from './queue-metrics.js'

const getJobCounts = vi.fn()
const getJobs = vi.fn()

vi.mock('./queue.js', () => ({
  mediaQueue: {
    getJobCounts: (...args: unknown[]) => getJobCounts(...args),
    getJobs: (...args: unknown[]) => getJobs(...args),
  },
}))

describe('queue-metrics', () => {
  beforeEach(() => {
    getJobCounts.mockReset()
    getJobs.mockReset()
  })

  it('aggregates overall counts and buckets waiting/active jobs by lane', async () => {
    getJobCounts.mockResolvedValue({ waiting: 3, active: 1, delayed: 0, failed: 2 })
    getJobs.mockImplementation((types: string[]) => {
      if (types[0] === 'waiting') {
        return Promise.resolve([
          { name: 'transcode-archive' },
          { name: 'transcode-archive' },
          { name: 'newsletter-dispatch' },
        ])
      }
      return Promise.resolve([{ name: 'separate-stems' }])
    })

    const snapshot = await collectQueueMetrics()

    expect(snapshot.waitingTotal).toBe(3)
    expect(snapshot.activeTotal).toBe(1)
    expect(snapshot.delayedTotal).toBe(0)
    expect(snapshot.failedTotal).toBe(2)
    expect(snapshot.byLane.transcode).toEqual({ waiting: 2, active: 1 })
    expect(snapshot.byLane.light).toEqual({ waiting: 1, active: 0 })
    expect(snapshot.byLane.media).toEqual({ waiting: 0, active: 0 })
  })

  it('renders overall and per-lane gauge lines', () => {
    const lines = renderQueueMetricLines({
      waitingTotal: 5,
      activeTotal: 2,
      delayedTotal: 0,
      failedTotal: 1,
      byLane: {
        transcode: { waiting: 2, active: 2 },
        media: { waiting: 1, active: 0 },
        dist: { waiting: 0, active: 0 },
        light: { waiting: 2, active: 0 },
        'edge-log': { waiting: 0, active: 0 },
      },
    })

    expect(lines).toContain('tahti_queue_jobs{state="waiting"} 5')
    expect(lines).toContain('tahti_queue_jobs_by_lane{lane="transcode",state="active"} 2')
  })
})
