// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { WORKER_CRON_JOBS, cronTaskNames } from '@tahti/shared'

describe('WORKER_CRON_JOBS', () => {
  it('has unique job names and jobIds', () => {
    const names = WORKER_CRON_JOBS.map((j) => j.name)
    const ids = WORKER_CRON_JOBS.map((j) => j.jobId)
    expect(new Set(names).size).toBe(names.length)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('includes core M1/M18/M19/M20 schedules', () => {
    const names = new Set(WORKER_CRON_JOBS.map((j) => j.name))
    expect(names).toContain('fan-sub-daily')
    expect(names).toContain('light-daily')
    expect(names).toContain('light-minute-tick')
    expect(names).toContain('membership-daily')
    expect(names).toContain('revelator-royalty-sync')
  })

  it('includes streaming infrastructure crons', () => {
    const names = new Set(WORKER_CRON_JOBS.map((j) => j.name))
    expect(names).toContain('hls-minio-sync')
    expect(names).toContain('media-minute-tick')
    expect(names).toContain('media-ten-minute-tick')
  })

  it('has unique task names across dispatchers and plain jobs', () => {
    const tasks = WORKER_CRON_JOBS.flatMap(cronTaskNames)
    expect(new Set(tasks).size).toBe(tasks.length)
  })

  it('lists sub-tasks for the merged daily/weekly dispatchers', () => {
    const byName = new Map(WORKER_CRON_JOBS.map((j) => [j.name, j]))
    expect(byName.get('fan-sub-daily')?.subTasks).toEqual([
      'fan-sub-payout',
      'fan-sub-expire',
      'fan-subscriber-purge',
    ])
    expect(byName.get('membership-daily')?.subTasks).toEqual([
      'membership-renewal-reminder',
      'membership-lapse',
    ])
    expect(byName.get('weekly-monday')?.subTasks).toEqual([
      'weekly-broadcast-reset',
      'tahti-selects-weekly-draw',
    ])
    expect(byName.get('media-daily-sweeps')?.subTasks).toEqual([
      'sweep-editor-peaks-backfill',
      'sweep-expired-stems',
    ])
  })

  it('lists sub-tasks for the per-minute and per-10-minute ticks', () => {
    const byName = new Map(WORKER_CRON_JOBS.map((j) => [j.name, j]))
    expect(byName.get('media-minute-tick')?.subTasks).toEqual([
      'channel-watchdog',
      'radio-slot-switchover',
      'channel-fallback-reconciler',
    ])
    expect(byName.get('light-minute-tick')?.subTasks).toEqual([
      'broadcast-cap-tick',
      'post-publish-notify',
    ])
    expect(byName.get('media-ten-minute-tick')?.subTasks).toEqual([
      'sidecar-cleanup',
      'sound-fallback-cache-sync',
      'hls-live-prune',
    ])
  })

  it('lists sub-tasks for the light-lane daily dispatcher', () => {
    const light = WORKER_CRON_JOBS.find((j) => j.name === 'light-daily')
    expect(light?.subTasks).toEqual([
      'tor-exit-list-sync',
      'download-fraud-scan',
      'live-show-recurrence-generate',
    ])
  })
})
