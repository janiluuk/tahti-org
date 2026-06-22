// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import {
  utcWeekStart,
  isUnlimitedLiveTier,
  FREE_WEEKLY_LIVE_CAP_SEC,
  FREE_WEEKLY_HARD_CAP_SEC,
  FREE_WEEKLY_LIVE_GRACE_SEC,
  canAcceptSourceConnect,
  broadcastWarningLevel,
} from './broadcast-cap.js'

describe('broadcast-cap', () => {
  it('utcWeekStart returns Monday 00:00 UTC', () => {
    const wed = new Date('2026-06-03T12:00:00Z')
    const start = utcWeekStart(wed)
    expect(start.getUTCDay()).toBe(1)
    expect(start.toISOString()).toBe('2026-06-01T00:00:00.000Z')
  })

  it('isUnlimitedLiveTier is false only for FREE', () => {
    expect(isUnlimitedLiveTier('FREE')).toBe(false)
    expect(isUnlimitedLiveTier('ARTIST')).toBe(true)
    expect(isUnlimitedLiveTier('STUDIO')).toBe(true)
  })

  it('exports a one-hour cap with 60s grace', () => {
    expect(FREE_WEEKLY_LIVE_CAP_SEC).toBe(3600)
    expect(FREE_WEEKLY_LIVE_GRACE_SEC).toBe(60)
    expect(FREE_WEEKLY_HARD_CAP_SEC).toBe(3660)
  })

  it('broadcastWarningLevel prefers 55m over 45m when both apply', () => {
    const cap = {
      allowed: true as const,
      secondsUsed: 55 * 60,
      secondsRemaining: 300,
      warnings: [45 * 60, 55 * 60],
      inGrace: false,
    }
    expect(broadcastWarningLevel(cap)).toBe('55m')
  })

  it('broadcastWarningLevel returns blocked when not allowed', () => {
    expect(broadcastWarningLevel({ allowed: false, reason: 'weekly_cap', secondsUsed: 4000 })).toBe(
      'blocked',
    )
  })

  it('canAcceptSourceConnect denies new connect during grace', () => {
    const cap = {
      allowed: true as const,
      secondsUsed: 3600,
      secondsRemaining: 0,
      warnings: [],
      inGrace: true,
    }
    expect(canAcceptSourceConnect(cap, 'OFFLINE')).toBe(false)
    expect(canAcceptSourceConnect(cap, 'LIVE')).toBe(true)
    expect(canAcceptSourceConnect(cap, 'PREVIEW')).toBe(true)
  })
})
