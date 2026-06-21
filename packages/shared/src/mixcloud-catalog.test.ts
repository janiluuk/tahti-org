// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it } from 'vitest'
import { mixcloudEmbedSrc, parseMixcloudUsername } from './mixcloud-catalog.js'

describe('mixcloud URL parsing + embed', () => {
  it('resolves a username from a profile URL', () => {
    expect(parseMixcloudUsername('https://www.mixcloud.com/nightwave/')).toBe('nightwave')
    expect(parseMixcloudUsername('https://mixcloud.com/nightwave')).toBe('nightwave')
  })

  it('accepts a bare handle', () => {
    expect(parseMixcloudUsername('nightwave')).toBe('nightwave')
  })

  it('rejects a cloudcast URL (two path segments) and garbage input', () => {
    expect(parseMixcloudUsername('https://www.mixcloud.com/nightwave/some-mix/')).toBe(null)
    expect(parseMixcloudUsername('https://example.com/nightwave')).toBe(null)
    expect(parseMixcloudUsername('')).toBe(null)
  })

  it('builds a widget embed src from a cloudcast URL', () => {
    const src = mixcloudEmbedSrc('https://www.mixcloud.com/nightwave/some-mix/')
    expect(src).toContain('https://www.mixcloud.com/widget/iframe/?')
    expect(src).toContain(encodeURIComponent('https://www.mixcloud.com/nightwave/some-mix/'))
  })
})
