// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it } from 'vitest'
import { normalizeReferrerHost, normalizeReferrerUrl } from './listen.js'

describe('normalizeReferrerUrl', () => {
  it('keeps a clean https URL without fragment or credentials', () => {
    expect(normalizeReferrerUrl('https://user:pass@example.com/camp?utm=1#frag')).toBe(
      'https://example.com/camp?utm=1',
    )
  })

  it('rejects non-http schemes and junk', () => {
    expect(normalizeReferrerUrl('javascript:alert(1)')).toBeNull()
    expect(normalizeReferrerUrl('not a url')).toBeNull()
    expect(normalizeReferrerUrl('')).toBeNull()
  })

  it('truncates oversized URLs', () => {
    const long = `https://example.com/${'a'.repeat(3000)}`
    const out = normalizeReferrerUrl(long)
    expect(out).not.toBeNull()
    expect(out!.length).toBeLessThanOrEqual(2048)
  })
})

describe('normalizeReferrerHost', () => {
  it('lower-cases and strips www', () => {
    expect(normalizeReferrerHost('WWW.Example.COM')).toBe('example.com')
  })

  it('rejects paths and ports', () => {
    expect(normalizeReferrerHost('example.com/path')).toBeNull()
  })
})
