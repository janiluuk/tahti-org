// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { isHeartbeatStale } from './discord-bot-heartbeat.js'

describe('isHeartbeatStale', () => {
  it('is not stale within the threshold', () => {
    expect(isHeartbeatStale(1_000, 1_000 + 30_000, 60_000)).toBe(false)
  })

  it('is stale once the threshold is exceeded', () => {
    expect(isHeartbeatStale(1_000, 1_000 + 60_001, 60_000)).toBe(true)
  })
})
