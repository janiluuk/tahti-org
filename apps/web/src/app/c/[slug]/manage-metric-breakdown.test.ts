// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it } from 'vitest'
import { buildMetricBreakdown, MANAGE_METRIC_KEYS } from './manage-metric-breakdown'

const stats = {
  audioBitrateKbps: 320,
  signalConnected: true,
  listeners: 12,
  listenerPeak: 28,
  plays: 142,
  likes: 18,
  reposts: 4,
  liveDurationSec: 5420,
}

describe('buildMetricBreakdown', () => {
  it('provides a demo breakdown for every channel metric', () => {
    for (const key of MANAGE_METRIC_KEYS) {
      const breakdown = buildMetricBreakdown(stats, key)
      expect(breakdown.label).toBeTruthy()
      expect(breakdown.value).toBeTruthy()
      expect(breakdown.items).toHaveLength(4)
    }
  })
})
