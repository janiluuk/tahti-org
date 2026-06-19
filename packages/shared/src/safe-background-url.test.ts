// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it } from 'vitest'
import { cssBackdropUrlValue, isAllowedBackdropUrl } from './safe-background-url.js'

describe('isAllowedBackdropUrl', () => {
  it('accepts HTTPS image URLs', () => {
    expect(isAllowedBackdropUrl('https://cdn.example.com/bg.jpg')).toBe(true)
  })

  it('accepts YouTube and Vimeo watch URLs', () => {
    expect(isAllowedBackdropUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true)
    expect(isAllowedBackdropUrl('https://vimeo.com/123456789')).toBe(true)
  })

  it('rejects non-HTTPS and CSS-breakout payloads', () => {
    expect(isAllowedBackdropUrl('http://example.com/x.jpg')).toBe(false)
    expect(isAllowedBackdropUrl('javascript:alert(1)')).toBe(false)
    expect(isAllowedBackdropUrl('https://evil.com/x.jpg);background:red')).toBe(false)
    expect(isAllowedBackdropUrl('https://evil.com/x.jpg")')).toBe(false)
  })
})

describe('cssBackdropUrlValue', () => {
  it('returns quoted url() for safe HTTPS URLs', () => {
    expect(cssBackdropUrlValue('https://cdn.example.com/bg.jpg')).toBe(
      'url("https://cdn.example.com/bg.jpg")',
    )
  })

  it('returns null for unsafe URLs', () => {
    expect(cssBackdropUrlValue('https://evil.com/x.jpg);background:red')).toBeNull()
  })
})
