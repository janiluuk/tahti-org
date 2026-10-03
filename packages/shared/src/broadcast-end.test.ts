// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { broadcastLiveHours } from './broadcast-end.js'

describe('broadcastLiveHours', () => {
  const end = new Date('2026-10-03T12:00:00Z')

  it('measures from going live to the end of the session', () => {
    expect(broadcastLiveHours(new Date('2026-10-03T10:30:00Z'), end)).toBe(1.5)
  })

  it('is zero for a session that never went live', () => {
    expect(broadcastLiveHours(null, end)).toBe(0)
  })

  it('never goes negative when clocks disagree', () => {
    expect(broadcastLiveHours(new Date('2026-10-03T12:00:05Z'), end)).toBe(0)
  })
})
