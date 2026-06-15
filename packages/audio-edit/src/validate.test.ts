// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it } from 'vitest'
import { createDefaultEditList } from './types.js'
import { validateEditList, validateEditListParsed } from './validate.js'

describe('validateEditList - schema rejection', () => {
  it('rejects NaN sourceDuration', () => {
    const edit = createDefaultEditList(60)
    const result = validateEditList({ ...edit, sourceDuration: NaN })
    expect(result.ok).toBe(false)
  })

  it('rejects Infinity sourceDuration', () => {
    const edit = createDefaultEditList(60)
    const result = validateEditList({ ...edit, sourceDuration: Infinity })
    expect(result.ok).toBe(false)
  })

  it('rejects NaN/Infinity in cut bounds', () => {
    const edit = createDefaultEditList(60)
    expect(validateEditList({ ...edit, cuts: [{ start: NaN, end: 10 }] }).ok).toBe(false)
    expect(validateEditList({ ...edit, cuts: [{ start: 0, end: Infinity }] }).ok).toBe(false)
  })

  it('rejects NaN/Infinity in fade fields', () => {
    const edit = createDefaultEditList(60)
    expect(validateEditList({ ...edit, fades: [{ type: 'in', at: NaN, duration: 1 }] }).ok).toBe(
      false,
    )
    expect(
      validateEditList({ ...edit, fades: [{ type: 'in', at: 0, duration: Infinity }] }).ok,
    ).toBe(false)
  })

  it('rejects NaN/Infinity gainDb and EQ band values', () => {
    const edit = createDefaultEditList(60)
    expect(validateEditList({ ...edit, gainDb: NaN }).ok).toBe(false)
    expect(validateEditList({ ...edit, gainDb: Infinity }).ok).toBe(false)
    expect(
      validateEditList({
        ...edit,
        eq: { enabled: true, bands: [{ freq: NaN, gainDb: 0, q: 1 }] },
      }).ok,
    ).toBe(false)
    expect(
      validateEditList({
        ...edit,
        eq: { enabled: true, bands: [{ freq: 100, gainDb: Infinity, q: 1 }] },
      }).ok,
    ).toBe(false)
  })

  it('rejects NaN/Infinity comp and limiter values', () => {
    const edit = createDefaultEditList(60)
    expect(
      validateEditList({
        ...edit,
        comp: { ...edit.comp, enabled: true, thresholdDb: NaN },
      }).ok,
    ).toBe(false)
    expect(
      validateEditList({
        ...edit,
        limiter: { enabled: true, ceilingDb: -1, releaseMs: Infinity },
      }).ok,
    ).toBe(false)
  })

  it('rejects NaN/Infinity loudnorm targets and measured values', () => {
    const edit = createDefaultEditList(60)
    expect(
      validateEditList({
        ...edit,
        loudnorm: { enabled: true, targetLufs: NaN, targetTp: -1.5 },
      }).ok,
    ).toBe(false)
    expect(
      validateEditList({
        ...edit,
        loudnorm: {
          enabled: true,
          targetLufs: -14,
          targetTp: -1.5,
          measured: { i: -Infinity, tp: -2.9, lra: 8.4, thresh: -28.1 },
        },
      }).ok,
    ).toBe(false)
  })

  it('rejects oversized cuts/fades arrays', () => {
    const edit = createDefaultEditList(10000)
    const cuts = Array.from({ length: 501 }, (_, i) => ({ start: i * 2, end: i * 2 + 1 }))
    expect(validateEditList({ ...edit, cuts }).ok).toBe(false)

    const fades = Array.from({ length: 101 }, () => ({ type: 'in' as const, at: 0, duration: 1 }))
    expect(validateEditList({ ...edit, fades }).ok).toBe(false)
  })
})

describe('validateEditListParsed - semantic rejection', () => {
  it('rejects a cut where end <= start', () => {
    const edit = createDefaultEditList(60)
    edit.cuts = [{ start: 10, end: 10 }]
    const result = validateEditListParsed(edit)
    expect(result.ok).toBe(false)
    expect(result.issues[0]?.path).toBe('cuts[0]')
  })

  it('rejects a cut extending past sourceDuration', () => {
    const edit = createDefaultEditList(60)
    edit.cuts = [{ start: 50, end: 70 }]
    const result = validateEditListParsed(edit)
    expect(result.ok).toBe(false)
    expect(result.issues.some((i) => i.message.includes('past source duration'))).toBe(true)
  })

  it('rejects when all audio is removed by overlapping cuts', () => {
    const edit = createDefaultEditList(60)
    edit.cuts = [
      { start: 0, end: 40 },
      { start: 30, end: 60 },
    ]
    const result = validateEditListParsed(edit)
    expect(result.ok).toBe(false)
    expect(result.issues.some((i) => i.message === 'All audio would be removed')).toBe(true)
  })

  it('rejects a fade anchored inside a cut region', () => {
    const edit = createDefaultEditList(60)
    edit.cuts = [{ start: 10, end: 20 }]
    edit.fades = [{ type: 'in', at: 15, duration: 1, curve: 'tri' }]
    const result = validateEditListParsed(edit)
    expect(result.ok).toBe(false)
    expect(result.issues.some((i) => i.path === 'fades[0]')).toBe(true)
  })

  it('rejects EQ enabled with no bands', () => {
    const edit = createDefaultEditList(60)
    edit.eq = { enabled: true, bands: [] }
    const result = validateEditListParsed(edit)
    expect(result.ok).toBe(false)
    expect(result.issues.some((i) => i.path === 'eq.bands')).toBe(true)
  })

  it('accepts a valid edit list', () => {
    const edit = createDefaultEditList(60)
    edit.cuts = [{ start: 10, end: 20 }]
    edit.fades = [{ type: 'in', at: 0, duration: 1, curve: 'tri' }]
    const result = validateEditListParsed(edit)
    expect(result.ok).toBe(true)
  })

  it('allows a zero-duration fade even when anchored inside a cut', () => {
    const edit = createDefaultEditList(60)
    edit.cuts = [{ start: 10, end: 20 }]
    edit.fades = [{ type: 'in', at: 15, duration: 0, curve: 'tri' }]
    const result = validateEditListParsed(edit)
    expect(result.ok).toBe(true)
  })
})
