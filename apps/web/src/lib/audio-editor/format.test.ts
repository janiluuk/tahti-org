// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, vi, afterEach } from 'vitest'
import { formatDuration, formatDurationDecimal, formatRelativeSave } from './format'

describe('formatDuration', () => {
  it.each([
    [0, '0:00'],
    [61, '1:01'],
    [3599, '59:59'],
    [-5, '0:00'],
    [Number.NaN, '0:00'],
    [Number.POSITIVE_INFINITY, '0:00'],
  ])('formats %s as %s', (sec, expected) => {
    expect(formatDuration(sec)).toBe(expected)
  })
})

describe('formatDurationDecimal', () => {
  it.each([
    [0, '0:00.0'],
    [61.25, '1:01.3'],
    [-1, '0:00.0'],
    [Number.NaN, '0:00.0'],
  ])('formats %s as %s', (sec, expected) => {
    expect(formatDurationDecimal(sec)).toBe(expected)
  })
})

describe('formatRelativeSave', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('buckets recent saves', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-10T12:00:00Z'))
    const now = Date.now()
    expect(formatRelativeSave(now)).toBe('just now')
    expect(formatRelativeSave(now - 30_000)).toBe('30s ago')
    expect(formatRelativeSave(now - 5 * 60_000)).toBe('5m ago')
    expect(typeof formatRelativeSave(now - 2 * 3_600_000)).toBe('string')
  })
})
