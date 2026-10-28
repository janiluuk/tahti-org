// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, vi } from 'vitest'
import {
  cacheForMs,
  liveStreamsCheckFrom,
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

describe('liveStreamsCheckFrom', () => {
  it('is up with a count when every live stream is fresh', () => {
    expect(liveStreamsCheckFrom({ checked: 3, alwaysOnChecked: true, silent: [] }, 7)).toEqual({
      id: 'live-streams',
      state: 'up',
      critical: true,
      latencyMs: 7,
      detail: '3 live streams fresh',
      silentLiveChannels: 0,
    })
  })

  it('is a critical outage when a 24/7 channel is silent', () => {
    const check = liveStreamsCheckFrom(
      {
        checked: 2,
        alwaysOnChecked: true,
        silent: [
          { slug: 'tahti-radio', alwaysOn: true, silentForMs: 30_660_000 },
          { slug: 'artist', alwaysOn: false, silentForMs: null },
        ],
      },
      5,
    )
    expect(check).toMatchObject({
      state: 'down',
      critical: true,
      detail: 'tahti-radio silent 8h 31m; artist no playlist',
      silentLiveChannels: 2,
    })
    expect(summarizeChecks([check])).toEqual({ status: 'outage', healthy: false })
  })

  it('is only degraded when just an artist channel is silent', () => {
    const check = liveStreamsCheckFrom(
      {
        checked: 2,
        alwaysOnChecked: true,
        silent: [{ slug: 'artist', alwaysOn: false, silentForMs: 90_000 }],
      },
      5,
    )
    expect(check).toMatchObject({ state: 'down', critical: false })
    expect(summarizeChecks([check])).toEqual({ status: 'degraded', healthy: false })
  })

  it('exports the silent count as a Prometheus gauge', () => {
    const check = liveStreamsCheckFrom(
      {
        checked: 1,
        alwaysOnChecked: false,
        silent: [{ slug: 'artist', alwaysOn: false, silentForMs: 90_000 }],
      },
      5,
    )
    const text = renderPrometheusMetrics([check], 1)
    expect(text).toContain('tahti_dependency_up{dependency="live-streams"} 0')
    expect(text).toContain('tahti_live_streams_silent 1')
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
