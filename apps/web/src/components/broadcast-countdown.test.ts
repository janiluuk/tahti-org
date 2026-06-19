// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { calcTimeLeft } from './broadcast-countdown.js'

describe('BroadcastCountdown — calcTimeLeft', () => {
  const now = Date.UTC(2026, 5, 19, 12, 0, 0)

  it('returns past when target is in the past', () => {
    const target = new Date(now - 1000)
    expect(calcTimeLeft(target, now)).toEqual({ days: 0, hrs: 0, min: 0, sec: 0, past: true })
  })

  it('returns past when target equals now', () => {
    const target = new Date(now)
    expect(calcTimeLeft(target, now)).toEqual({ days: 0, hrs: 0, min: 0, sec: 0, past: true })
  })

  it('decomposes remaining time into days, hours, minutes, seconds', () => {
    const target = new Date(now + 90_061_000) // 1d + 1h + 1m + 1s
    expect(calcTimeLeft(target, now)).toEqual({ days: 1, hrs: 1, min: 1, sec: 1, past: false })
  })

  it('handles sub-minute countdown', () => {
    const target = new Date(now + 45_000)
    expect(calcTimeLeft(target, now)).toEqual({ days: 0, hrs: 0, min: 0, sec: 45, past: false })
  })
})
