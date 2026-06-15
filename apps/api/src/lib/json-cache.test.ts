// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGet, mockSet, mockGetRedisClient } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockSet: vi.fn(),
  mockGetRedisClient: vi.fn(),
}))

vi.mock('./redis.js', () => ({
  getRedisClient: mockGetRedisClient,
}))

import { getCachedJson } from './json-cache.js'

describe('getCachedJson', () => {
  beforeEach(() => {
    mockGet.mockReset()
    mockSet.mockReset()
    mockGetRedisClient.mockReset()
  })

  it('computes and caches on a miss', async () => {
    mockGetRedisClient.mockResolvedValue({ get: mockGet, set: mockSet })
    mockGet.mockResolvedValue(null)
    const compute = vi.fn().mockResolvedValue({ value: 42 })

    const result = await getCachedJson('k', 10, compute)

    expect(result).toEqual({ value: 42 })
    expect(compute).toHaveBeenCalledTimes(1)
    expect(mockSet).toHaveBeenCalledWith('k', JSON.stringify({ value: 42 }), { EX: 10 })
  })

  it('returns the cached value without recomputing on a hit', async () => {
    mockGetRedisClient.mockResolvedValue({ get: mockGet, set: mockSet })
    mockGet.mockResolvedValue(JSON.stringify({ value: 7 }))
    const compute = vi.fn().mockResolvedValue({ value: 99 })

    const result = await getCachedJson('k', 10, compute)

    expect(result).toEqual({ value: 7 })
    expect(compute).not.toHaveBeenCalled()
    expect(mockSet).not.toHaveBeenCalled()
  })

  it('falls back to compute when redis is unavailable', async () => {
    mockGetRedisClient.mockResolvedValue(null)
    const compute = vi.fn().mockResolvedValue({ value: 1 })

    const result = await getCachedJson('k', 10, compute)

    expect(result).toEqual({ value: 1 })
    expect(compute).toHaveBeenCalledTimes(1)
  })

  it('falls back to compute when redis.get throws', async () => {
    mockGetRedisClient.mockResolvedValue({
      get: vi.fn().mockRejectedValue(new Error('boom')),
      set: mockSet,
    })
    const compute = vi.fn().mockResolvedValue({ value: 5 })

    const result = await getCachedJson('k', 10, compute)

    expect(result).toEqual({ value: 5 })
    expect(compute).toHaveBeenCalledTimes(1)
  })
})
