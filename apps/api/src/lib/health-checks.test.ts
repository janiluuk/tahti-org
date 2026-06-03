// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { renderPrometheusMetrics, summarizeChecks, type DependencyCheck } from './health-checks.js'

describe('health-checks helpers', () => {
  it('summarizeChecks marks outage when critical dependency is down', () => {
    const checks: DependencyCheck[] = [
      { id: 'postgres', state: 'down', critical: true, latencyMs: 1, detail: 'err' },
      { id: 'redis', state: 'up', critical: true, latencyMs: 1 },
    ]
    expect(summarizeChecks(checks)).toEqual({ status: 'outage', healthy: false })
  })

  it('summarizeChecks marks degraded when only non-critical is down', () => {
    const checks: DependencyCheck[] = [
      { id: 'postgres', state: 'up', critical: true, latencyMs: 1 },
      { id: 'centrifugo', state: 'down', critical: false, latencyMs: 1 },
    ]
    expect(summarizeChecks(checks)).toEqual({ status: 'degraded', healthy: false })
  })

  it('renderPrometheusMetrics exports gauges', () => {
    const checks: DependencyCheck[] = [
      { id: 'postgres', state: 'up', critical: true, latencyMs: 4 },
      { id: 'redis', state: 'down', critical: true, latencyMs: 9 },
    ]
    const text = renderPrometheusMetrics(checks, 120)
    expect(text).toContain('tahti_dependency_up{dependency="postgres"} 1')
    expect(text).toContain('tahti_dependency_up{dependency="redis"} 0')
    expect(text).toContain('tahti_api_uptime_seconds 120')
    expect(text).toContain('tahti_api_healthy 0')
  })
})
