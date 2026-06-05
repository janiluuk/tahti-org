// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeEach } from 'vitest'
import {
  recordAcrcloudIdentifyMatch,
  recordAcrcloudIdentifyMiss,
  recordAcrcloudIdentifyRequest,
  renderAcrcloudMetricLines,
  resetAcrcloudMetricsForTest,
} from './acrcloud-metrics.js'

describe('acrcloud-metrics', () => {
  beforeEach(() => {
    resetAcrcloudMetricsForTest()
  })

  it('renders Prometheus counters', () => {
    recordAcrcloudIdentifyRequest()
    recordAcrcloudIdentifyRequest()
    recordAcrcloudIdentifyMatch()
    recordAcrcloudIdentifyMiss()
    const lines = renderAcrcloudMetricLines().join('\n')
    expect(lines).toContain('tahti_acrcloud_identify_requests_total 2')
    expect(lines).toContain('tahti_acrcloud_identify_matches_total 1')
    expect(lines).toContain('tahti_acrcloud_identify_misses_total 1')
  })
})
