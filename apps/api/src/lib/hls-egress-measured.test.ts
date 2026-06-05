// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGet = vi.fn()

vi.mock('./redis.js', () => ({
  getRedisClient: vi.fn(async () => ({ get: mockGet })),
}))

import { fetchMeasuredHlsEgressByDate } from './hls-egress-measured.js'

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
