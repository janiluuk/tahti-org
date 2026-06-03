// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeEach } from 'vitest'
import {
  recordHttpRequest,
  renderHttpMetricLines,
  resetHttpMetricsForTests,
  statusClass,
} from './http-metrics.js'

describe('http-metrics', () => {
  beforeEach(() => resetHttpMetricsForTests())

  it('classifies status codes', () => {
    expect(statusClass(200)).toBe('2xx')
    expect(statusClass(404)).toBe('4xx')
    expect(statusClass(503)).toBe('5xx')
  })

  it('renders counters after recording', () => {
    recordHttpRequest(200, 12)
    recordHttpRequest(500, 40)
    const text = renderHttpMetricLines().join('\n')
    expect(text).toContain('tahti_http_requests_total{status_class="2xx"} 1')
    expect(text).toContain('tahti_http_requests_total{status_class="5xx"} 1')
    expect(text).toContain('tahti_http_request_duration_ms_sum 52')
    expect(text).toContain('tahti_http_request_duration_ms_count 2')
  })
})
