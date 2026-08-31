// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it } from 'vitest'
import {
  ChannelVisualPatchSchema,
  DEFAULT_COLOR_SCHEME,
  parseColorScheme,
  resolveColorScheme,
} from './visual-preset.js'

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

describe('ChannelVisualPatchSchema videoBackgroundUrl', () => {
  it('accepts a direct .mp4/.webm file, null, or omission', () => {
    expect(
      ChannelVisualPatchSchema.safeParse({
        headerStyle: 'VIDEO_LOOP',
        videoBackgroundUrl: 'https://cdn.example.com/loop.mp4',
      }).success,
    ).toBe(true)
    expect(ChannelVisualPatchSchema.safeParse({ videoBackgroundUrl: null }).success).toBe(true)
    expect(ChannelVisualPatchSchema.safeParse({}).success).toBe(true)
  })

  it('rejects a YouTube/Vimeo link when headerStyle is VIDEO_LOOP — that style renders a raw <video>, not an iframe embed', () => {
    const result = ChannelVisualPatchSchema.safeParse({
      headerStyle: 'VIDEO_LOOP',
      videoBackgroundUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    })
    expect(result.success).toBe(false)
  })

  it('accepts a static image URL for the shared Gallery/backdrop use of this column when headerStyle is not VIDEO_LOOP', () => {
    expect(
      ChannelVisualPatchSchema.safeParse({
        headerStyle: 'GRADIENT',
        videoBackgroundUrl: 'https://cdn.example.com/backdrop.png',
      }).success,
    ).toBe(true)
    // headerStyle omitted entirely (a patch that doesn't touch it) — still
    // shouldn't require a direct video file.
    expect(
      ChannelVisualPatchSchema.safeParse({
        videoBackgroundUrl: 'https://cdn.example.com/backdrop.jpg',
      }).success,
    ).toBe(true)
  })

  it('rejects a static image URL when headerStyle is VIDEO_LOOP', () => {
    const result = ChannelVisualPatchSchema.safeParse({
      headerStyle: 'VIDEO_LOOP',
      videoBackgroundUrl: 'https://cdn.example.com/backdrop.png',
    })
    expect(result.success).toBe(false)
  })
})
