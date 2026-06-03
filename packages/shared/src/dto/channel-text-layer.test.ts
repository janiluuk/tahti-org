// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { ChannelTextLayerPatchSchema, isActiveTextLayer } from './channel-text-layer.js'

describe('channel text layer DTO', () => {
  it('accepts gradient shimmer mode with text', () => {
    const parsed = ChannelTextLayerPatchSchema.parse({
      textLayerMode: 'GRADIENT_SHIMMER',
      textLayerText: 'Now streaming live',
      textLayerAlign: 'CENTER',
    })
    expect(parsed.textLayerMode).toBe('GRADIENT_SHIMMER')
    expect(parsed.textLayerText).toBe('Now streaming live')
  })

  it('accepts all text effect modes', () => {
    for (const mode of ['COSMIC_NEON', 'LAYERED_WAVE_3D', 'SHIMMER_LINES', 'GHOST_ECHO'] as const) {
      const parsed = ChannelTextLayerPatchSchema.parse({
        textLayerMode: mode,
        textLayerText: 'Hello',
      })
      expect(parsed.textLayerMode).toBe(mode)
    }
  })

  it('rejects invalid text layer mode', () => {
    expect(() => ChannelTextLayerPatchSchema.parse({ textLayerMode: 'INVALID' })).toThrow()
  })

  it('rejects empty text when provided', () => {
    expect(() => ChannelTextLayerPatchSchema.parse({ textLayerText: 'a'.repeat(121) })).toThrow()
  })

  it('detects active text layer', () => {
    expect(isActiveTextLayer({ textLayerMode: 'COSMIC_NEON', textLayerText: 'Live now' })).toBe(
      true,
    )
    expect(isActiveTextLayer({ textLayerMode: 'NONE', textLayerText: 'Live now' })).toBe(false)
    expect(isActiveTextLayer({ textLayerMode: 'COSMIC_NEON', textLayerText: '  ' })).toBe(false)
  })
})
