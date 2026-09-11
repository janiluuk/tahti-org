// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it } from 'vitest'

import { ALL_WORKER_LANES, jobNamesForLanes } from './worker-job-lanes'
import { WORKER_CRON_JOBS } from './worker-cron-jobs'

describe('WORKER_JOB_LANES', () => {
  it('covers every scheduled cron job name', () => {
    // A cron job missing from every lane never runs on a lane-filtered worker
    // (infra/docker-stack.yml and infra/docker-compose.stack.yml both pass
    // --queues). Confirmed live: listen-session-close was scheduled every 3
    // minutes but absent from every lane, so it failed with lane-mismatch on
    // every tick until this test was added.
    const allowed = jobNamesForLanes(ALL_WORKER_LANES)
    const missing = WORKER_CRON_JOBS.map((job) => job.name).filter((name) => !allowed.has(name))
    expect(missing).toEqual([])
  })
})
