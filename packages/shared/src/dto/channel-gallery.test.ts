// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import {
  ChannelGalleryPatchSchema,
  isWebGLGalleryMode,
  parseGalleryImageLines,
} from './channel-gallery.js'

describe('channel gallery DTO', () => {
  it('accepts twisted wave mode with image URLs', () => {
    const parsed = ChannelGalleryPatchSchema.parse({
      galleryMode: 'TWISTED_WAVE_GLSL',
      slideshowImages: ['https://cdn.example/a.jpg', 'https://cdn.example/b.jpg'],
    })
    expect(parsed.galleryMode).toBe('TWISTED_WAVE_GLSL')
    expect(parsed.slideshowImages).toHaveLength(2)
  })

  it('accepts all WebGL gallery modes', () => {
    for (const mode of [
      'ZOOM_BLUR_GLSL',
      'RGB_SHIFT_GLSL',
      'POSTER_WALL_GLSL',
      'SHATTER_CAROUSEL_GLSL',
    ] as const) {
      const parsed = ChannelGalleryPatchSchema.parse({
        galleryMode: mode,
        slideshowImages: ['https://cdn.example/a.jpg'],
      })
      expect(parsed.galleryMode).toBe(mode)
      expect(isWebGLGalleryMode(mode)).toBe(true)
    }
  })

  it('rejects invalid gallery mode', () => {
    expect(() => ChannelGalleryPatchSchema.parse({ galleryMode: 'INVALID' })).toThrow()
  })

  it('parses newline-separated HTTPS URLs', () => {
    const urls = parseGalleryImageLines(
      'https://a.example/1.jpg\nftp://bad\nhttps://b.example/2.jpg\n',
    )
    expect(urls).toEqual(['https://a.example/1.jpg', 'https://b.example/2.jpg'])
  })
})
