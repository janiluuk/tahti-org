// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it } from 'vitest'
import { editListFromV0Trim } from './v0-trim.js'

describe('editListFromV0Trim', () => {
  it('maps trim selection to keep-region cuts and fades', () => {
    const edit = editListFromV0Trim({
      sourceDuration: 120,
      startSec: 10,
      endSec: 40,
      fadeInSec: 1,
      fadeOutSec: 2,
      peakNormalize: false,
      lufsTarget: 'none',
      limiterEnabled: false,
      highPassHz: 0,
      lowPassHz: 0,
      eq: { lowGainDb: 0, midGainDb: 0, highGainDb: 0 },
      compressorEnabled: false,
    })

    expect(edit.cuts).toEqual([
      { start: 0, end: 10 },
      { start: 40, end: 120 },
    ])
    expect(edit.fades).toEqual([
      { type: 'in', at: 10, duration: 1, curve: 'tri' },
      { type: 'out', at: 38, duration: 2, curve: 'tri' },
    ])
  })

  it('enables loudnorm for stream target and limiter when requested', () => {
    const edit = editListFromV0Trim({
      sourceDuration: 60,
      startSec: 0,
      endSec: 30,
      fadeInSec: 0,
      fadeOutSec: 0,
      peakNormalize: false,
      lufsTarget: 'stream',
      limiterEnabled: true,
      highPassHz: 80,
      lowPassHz: 16000,
      eq: { lowGainDb: 2, midGainDb: 0, highGainDb: -1 },
      compressorEnabled: true,
    })

    expect(edit.loudnorm.enabled).toBe(true)
    expect(edit.limiter.enabled).toBe(true)
    expect(edit.highPassHz).toBe(80)
    expect(edit.lowPassHz).toBe(16000)
    expect(edit.eq.enabled).toBe(true)
    expect(edit.comp.enabled).toBe(true)
  })
})
