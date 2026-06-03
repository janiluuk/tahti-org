// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it } from 'vitest'
import { parseVideoEmbedUrl } from './video-embed.js'

describe('parseVideoEmbedUrl', () => {
  it('parses YouTube watch URLs', () => {
    const r = parseVideoEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    expect(r?.provider).toBe('youtube')
    expect(r?.embedUrl).toContain('dQw4w9WgXcQ')
  })

  it('parses youtu.be short links', () => {
    const r = parseVideoEmbedUrl('https://youtu.be/abc123XYZ')
    expect(r?.embedUrl).toContain('abc123XYZ')
  })

  it('parses Vimeo URLs', () => {
    const r = parseVideoEmbedUrl('https://vimeo.com/123456789')
    expect(r?.provider).toBe('vimeo')
    expect(r?.embedUrl).toBe('https://player.vimeo.com/video/123456789')
  })

  it('returns null for non-video URLs', () => {
    expect(parseVideoEmbedUrl('https://example.com/image.jpg')).toBeNull()
  })
})
