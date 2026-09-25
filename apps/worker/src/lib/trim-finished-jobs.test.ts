// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, vi } from 'vitest'
import { trimFinishedJobs } from './trim-finished-jobs.js'

const ids = (n: number) => Array.from({ length: n }, (_, i) => String(i))

describe('trimFinishedJobs', () => {
  it('cleans in batches until a short batch, completed then failed', async () => {
    const clean = vi
      .fn()
      .mockResolvedValueOnce(ids(3))
      .mockResolvedValueOnce(ids(3))
      .mockResolvedValueOnce(ids(1))
      .mockResolvedValueOnce(ids(2))

    const totals = await trimFinishedJobs({ clean }, { graceMs: 1000, batchSize: 3, pauseMs: 0 })

    expect(totals).toEqual({ completed: 7, failed: 2 })
    expect(clean.mock.calls).toEqual([
      [1000, 3, 'completed'],
      [1000, 3, 'completed'],
      [1000, 3, 'completed'],
      [1000, 3, 'failed'],
    ])
  })
})
