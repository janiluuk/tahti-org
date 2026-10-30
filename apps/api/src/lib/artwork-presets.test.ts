// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { afterEach, describe, expect, it } from 'vitest'
import { absoluteArtworkUrl, pickArtworkUrl } from './artwork-presets.js'

describe('artwork presets', () => {
  const original = process.env.PUBLIC_WEB_URL
  afterEach(() => {
    process.env.PUBLIC_WEB_URL = original
  })

  it('resolves web-app paths against PUBLIC_WEB_URL', () => {
    process.env.PUBLIC_WEB_URL = 'https://beta.tahti.live/'
    expect(absoluteArtworkUrl('/artwork-presets/artwork-01.webp')).toBe(
      'https://beta.tahti.live/artwork-presets/artwork-01.webp',
    )
    expect(absoluteArtworkUrl('https://cdn.test/a.webp')).toBe('https://cdn.test/a.webp')
  })

  it('picks the same preset for the same seed and none from an empty set', () => {
    const urls = ['a', 'b', 'c']
    expect(pickArtworkUrl(urls, 'sound-1')).toBe(pickArtworkUrl(urls, 'sound-1'))
    expect(urls).toContain(pickArtworkUrl(urls, 'sound-2'))
    expect(pickArtworkUrl([], 'sound-1')).toBeNull()
  })
})
