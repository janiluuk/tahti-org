// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { WORKER_CRON_JOBS } from './cron-manifest.js'

describe('WORKER_CRON_JOBS', () => {
  it('has unique job names and jobIds', () => {
    const names = WORKER_CRON_JOBS.map((j) => j.name)
    const ids = WORKER_CRON_JOBS.map((j) => j.jobId)
    expect(new Set(names).size).toBe(names.length)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('includes core M1/M18/M19/M20 schedules', () => {
    const names = new Set(WORKER_CRON_JOBS.map((j) => j.name))
    expect(names).toContain('fan-sub-payout')
    expect(names).toContain('download-fraud-scan')
    expect(names).toContain('broadcast-cap-tick')
    expect(names).toContain('membership-lapse')
    expect(names).toContain('revelator-royalty-sync')
  })

  it('includes streaming infrastructure crons', () => {
    const names = new Set(WORKER_CRON_JOBS.map((j) => j.name))
    expect(names).toContain('hls-minio-sync')
    expect(names).toContain('channel-watchdog')
    expect(names).toContain('archive-fallback-cache-sync')
  })
})
