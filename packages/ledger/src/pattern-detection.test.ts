// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it } from 'vitest'
import {
  coefficientOfVariation,
  detectBatchAccounts,
  detectEvenIntervals,
  detectNetworkClusters,
  detectReciprocalRings,
  flagsFromCountedDownloads,
  jaccardSimilarity,
} from './pattern-detection.js'

describe('coefficientOfVariation', () => {
  it('is zero for identical values', () => {
    expect(coefficientOfVariation([10, 10, 10, 10])).toBe(0)
  })

  it('grows when values spread', () => {
    expect(coefficientOfVariation([1, 2, 3, 4, 5])).toBeGreaterThan(0.3)
  })
})

describe('detectEvenIntervals', () => {
  it('flags regular gaps', () => {
    const start = 1_000_000
    const times = Array.from({ length: 15 }, (_, i) => start + i * 60_000)
    const result = detectEvenIntervals(times)
    expect(result.flagged).toBe(true)
    expect(result.cv).toBeLessThan(0.01)
  })

  it('ignores irregular or short series', () => {
    expect(detectEvenIntervals([1, 2, 100, 101, 500]).flagged).toBe(false)
    const irregular = [0, 10, 50, 51, 200, 800, 801, 2000, 5000, 5001, 9000, 20_000, 50_000]
    expect(detectEvenIntervals(irregular).flagged).toBe(false)
  })
})

describe('detectNetworkClusters', () => {
  it('flags when top IPs dominate', () => {
    const counts = new Map([
      ['a', 10],
      ['b', 8],
      ['c', 6],
      ['d', 1],
      ['e', 1],
    ])
    const result = detectNetworkClusters(counts)
    expect(result.flagged).toBe(true)
    expect(result.topShare).toBeGreaterThanOrEqual(0.7)
  })

  it('ignores low volume', () => {
    expect(
      detectNetworkClusters(
        new Map([
          ['a', 5],
          ['b', 5],
        ]),
      ).flagged,
    ).toBe(false)
  })
})

describe('detectBatchAccounts', () => {
  it('flags a creation cluster', () => {
    const base = new Date('2026-06-01T00:00:00.000Z')
    const accounts = Array.from({ length: 6 }, (_, i) => ({
      userId: `u${i}`,
      createdAt: new Date(base.getTime() + i * 60 * 60 * 1000),
    }))
    expect(detectBatchAccounts(accounts).flagged).toBe(true)
  })

  it('ignores spread-out signups', () => {
    const accounts = Array.from({ length: 6 }, (_, i) => ({
      userId: `u${i}`,
      createdAt: new Date(`2026-0${i + 1}-01T00:00:00.000Z`),
    }))
    expect(detectBatchAccounts(accounts).flagged).toBe(false)
  })
})

describe('jaccardSimilarity / reciprocal rings', () => {
  it('scores overlapping IP sets', () => {
    expect(jaccardSimilarity(new Set(['a', 'b']), new Set(['b', 'c']))).toBeCloseTo(1 / 3)
  })

  it('pairs channels above the overlap floor', () => {
    const ips = new Map([
      ['ch-a', new Set(['1', '2', '3', '4'])],
      ['ch-b', new Set(['2', '3', '4', '5'])],
      ['ch-c', new Set(['9'])],
    ])
    const totals = new Map([
      ['ch-a', 20],
      ['ch-b', 20],
      ['ch-c', 20],
    ])
    const pairs = detectReciprocalRings(ips, totals)
    expect(pairs).toEqual([expect.objectContaining({ channelA: 'ch-a', channelB: 'ch-b' })])
  })
})

describe('flagsFromCountedDownloads', () => {
  it('emits even-interval and network-cluster flags', () => {
    const start = new Date('2026-06-01T00:00:00.000Z').getTime()
    const downloads = Array.from({ length: 20 }, (_, i) => ({
      channelId: 'ch-1',
      byIpHash: i < 16 ? `ip-${i % 3}` : `ip-other-${i}`,
      byUserId: null,
      countedAt: new Date(start + i * 60_000),
    }))
    const flags = flagsFromCountedDownloads({
      downloads,
      accountsByChannel: new Map(),
    })
    expect(flags.some((f) => f.code === 'EVEN_INTERVALS')).toBe(true)
    expect(flags.some((f) => f.code === 'NETWORK_CLUSTERS')).toBe(true)
  })
})
