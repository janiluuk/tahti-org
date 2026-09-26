// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, vi } from 'vitest'
import {
  cacheForMs,
  renderPrometheusMetrics,
  summarizeChecks,
  type DependencyCheck,
} from './health-checks.js'

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

describe('cacheForMs', () => {
  it('reuses a result within the TTL and reruns after it', async () => {
    let t = 0
    const run = vi.fn().mockResolvedValueOnce('a').mockResolvedValueOnce('b')
    const cached = cacheForMs(run, 5000, () => t)

    expect(await cached()).toBe('a')
    t = 4999
    expect(await cached()).toBe('a')
    t = 5000
    expect(await cached()).toBe('b')
    expect(run).toHaveBeenCalledTimes(2)
  })

  it('shares one in-flight run between concurrent callers', async () => {
    let resolve!: (v: string) => void
    const run = vi.fn(() => new Promise<string>((r) => (resolve = r)))
    const cached = cacheForMs(run, 0)

    const both = Promise.all([cached(), cached()])
    resolve('x')
    expect(await both).toEqual(['x', 'x'])
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('does not cache a failed run', async () => {
    const run = vi.fn().mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce('ok')
    const cached = cacheForMs(run, 5000)

    await expect(cached()).rejects.toThrow('down')
    expect(await cached()).toBe('ok')
  })
})
