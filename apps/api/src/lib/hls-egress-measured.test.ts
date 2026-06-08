// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGet = vi.fn()
const mockSCard = vi.fn()

vi.mock('./redis.js', () => ({
  getRedisClient: vi.fn(async () => ({ get: mockGet, sCard: mockSCard })),
}))

import {
  fetchMeasuredHlsEgressByDate,
  fetchMeasuredHlsListenersByDate,
} from './hls-egress-measured.js'

describe('fetchMeasuredHlsEgressByDate', () => {
  beforeEach(() => {
    mockGet.mockReset()
  })

  it('returns zeroes when redis keys are missing', async () => {
    mockGet.mockResolvedValue(null)
    const out = await fetchMeasuredHlsEgressByDate('demo', ['2026-06-01', '2026-06-02'])
    expect(out).toEqual({ '2026-06-01': 0, '2026-06-02': 0 })
  })

  it('parses stored byte totals', async () => {
    mockGet.mockImplementation(async (key: string) => {
      if (key.endsWith('2026-06-02')) return '9000'
      return null
    })
    const out = await fetchMeasuredHlsEgressByDate('demo', ['2026-06-01', '2026-06-02'])
    expect(out['2026-06-02']).toBe(9000)
  })
})

describe('fetchMeasuredHlsListenersByDate', () => {
  beforeEach(() => {
    mockSCard.mockReset()
  })

  it('returns the distinct-listener set cardinality per UTC day', async () => {
    mockSCard.mockImplementation(async (key: string) => (key.endsWith('2026-06-02') ? 12 : 0))
    const out = await fetchMeasuredHlsListenersByDate('demo', ['2026-06-01', '2026-06-02'])
    expect(out).toEqual({ '2026-06-01': 0, '2026-06-02': 12 })
    expect(mockSCard).toHaveBeenCalledWith('tahti:hls-listeners:demo:2026-06-01')
    expect(mockSCard).toHaveBeenCalledWith('tahti:hls-listeners:demo:2026-06-02')
  })
})
