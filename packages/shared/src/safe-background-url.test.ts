// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it } from 'vitest'
import {
  cssBackdropUrlValue,
  isAllowedBackdropUrl,
  isDirectVideoFileUrl,
} from './safe-background-url.js'

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

describe('isDirectVideoFileUrl', () => {
  it('accepts HTTPS .mp4 and .webm files', () => {
    expect(isDirectVideoFileUrl('https://cdn.example.com/loop.mp4')).toBe(true)
    expect(isDirectVideoFileUrl('https://cdn.example.com/loop.webm')).toBe(true)
  })

  it('accepts a query string after the extension', () => {
    expect(isDirectVideoFileUrl('https://cdn.example.com/loop.mp4?v=2')).toBe(true)
  })

  it('rejects YouTube/Vimeo links, unlike isAllowedBackdropUrl', () => {
    expect(isDirectVideoFileUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(false)
    expect(isAllowedBackdropUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true)
  })

  it('rejects non-HTTPS, non-video, and CSS-breakout payloads', () => {
    expect(isDirectVideoFileUrl('http://cdn.example.com/loop.mp4')).toBe(false)
    expect(isDirectVideoFileUrl('https://cdn.example.com/loop.mp3')).toBe(false)
    expect(isDirectVideoFileUrl('https://evil.com/x.mp4");background:red')).toBe(false)
    expect(isDirectVideoFileUrl('')).toBe(false)
  })
})
