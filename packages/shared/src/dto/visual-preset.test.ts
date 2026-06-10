// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it } from 'vitest'
import { DEFAULT_COLOR_SCHEME, parseColorScheme, resolveColorScheme } from './visual-preset.js'

describe('visual-preset color scheme', () => {
  const scheme = {
    bg: '#111111',
    accent: '#222222',
    text: '#333333',
    muted: '#444444',
    highlight: '#555555',
  }

  it('parseColorScheme returns null for empty input', () => {
    expect(parseColorScheme(null)).toBeNull()
    expect(parseColorScheme(undefined)).toBeNull()
    expect(parseColorScheme('')).toBeNull()
  })

  it('parseColorScheme validates hex palette JSON', () => {
    expect(parseColorScheme(JSON.stringify(scheme))).toEqual(scheme)
    expect(parseColorScheme(JSON.stringify({ ...scheme, bg: 'red' }))).toBeNull()
  })

  it('resolveColorScheme prefers manual override over extracted palette', () => {
    const extracted = { ...scheme, accent: '#aaaaaa' }
    const override = { ...scheme, accent: '#bbbbbb' }
    expect(resolveColorScheme(JSON.stringify(override), JSON.stringify(extracted)).accent).toBe(
      '#bbbbbb',
    )
  })

  it('resolveColorScheme falls back to palette then platform defaults', () => {
    expect(resolveColorScheme(null, JSON.stringify(scheme))).toEqual(scheme)
    expect(resolveColorScheme(null, null)).toEqual(DEFAULT_COLOR_SCHEME)
  })
})
