// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it } from 'vitest'
import { camelotDistance, suggestMixOrder, toCamelot } from './camelot.js'

describe('toCamelot', () => {
  it('reads the ways keys are written on sounds', () => {
    expect(toCamelot('Am')).toEqual({ number: 8, letter: 'A' })
    expect(toCamelot('A minor')).toEqual({ number: 8, letter: 'A' })
    expect(toCamelot('C')).toEqual({ number: 8, letter: 'B' })
    expect(toCamelot('Gb major')).toEqual({ number: 2, letter: 'B' })
    expect(toCamelot('F#m')).toEqual({ number: 11, letter: 'A' })
    expect(toCamelot('8a')).toEqual({ number: 8, letter: 'A' })
    expect(toCamelot('12B')).toEqual({ number: 12, letter: 'B' })
  })

  it('returns null for anything else', () => {
    expect(toCamelot(null)).toBeNull()
    expect(toCamelot('')).toBeNull()
    expect(toCamelot('H')).toBeNull()
    expect(toCamelot('13A')).toBeNull()
  })
})

describe('camelotDistance', () => {
  it('counts neighbours and the relative key as one step, wrapping around 12', () => {
    expect(camelotDistance(toCamelot('8A')!, toCamelot('8A')!)).toBe(0)
    expect(camelotDistance(toCamelot('8A')!, toCamelot('9A')!)).toBe(1)
    expect(camelotDistance(toCamelot('8A')!, toCamelot('8B')!)).toBe(1)
    expect(camelotDistance(toCamelot('12A')!, toCamelot('1A')!)).toBe(1)
    expect(camelotDistance(toCamelot('1A')!, toCamelot('7B')!)).toBe(7)
  })
})

describe('suggestMixOrder', () => {
  it('starts slowest and walks the wheel, leaving keyless tracks unplaced', () => {
    const { ordered, unplaced } = suggestMixOrder([
      { id: 'far', bpm: 124, key: '2B' },
      { id: 'start', bpm: 118, key: '8A' },
      { id: 'next', bpm: 122, key: '9A' },
      { id: 'none', bpm: 120, key: null },
      { id: 'relative', bpm: 120, key: '8B' },
    ])
    expect(ordered.map((t) => t.id)).toEqual(['start', 'relative', 'next', 'far'])
    expect(ordered[0]!.camelot).toBe('8A')
    expect(unplaced.map((t) => t.id)).toEqual(['none'])
  })
})
