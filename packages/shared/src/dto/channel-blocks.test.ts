// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it } from 'vitest'
import {
  CreateChannelBlockSchema,
  PatchChannelBlockSchema,
  ReorderChannelBlocksSchema,
} from './channel-blocks.js'

describe('CreateChannelBlockSchema', () => {
  it('accepts a LOGO block with assetId + http(s) url', () => {
    const parsed = CreateChannelBlockSchema.parse({
      type: 'LOGO',
      width: 'HALF',
      configJson: {
        assetId: 'media/artist/abc.png',
        url: 'https://cdn.example/media/artist/abc.png',
      },
    })
    expect(parsed.type).toBe('LOGO')
    expect(parsed.width).toBe('HALF')
  })

  it('accepts an ADDON block referencing an install id', () => {
    const parsed = CreateChannelBlockSchema.parse({
      type: 'ADDON',
      configJson: { addonInstallId: 'clxxxxxxxxxxxxxxxxxxxx' },
    })
    expect(parsed.type).toBe('ADDON')
    expect(parsed.width).toBeUndefined()
  })

  it('rejects a LOGO block missing url', () => {
    expect(() =>
      CreateChannelBlockSchema.parse({
        type: 'LOGO',
        configJson: { assetId: 'media/artist/abc.png' },
      }),
    ).toThrow()
  })

  it('rejects javascript: logo urls', () => {
    expect(() =>
      CreateChannelBlockSchema.parse({
        type: 'LOGO',
        configJson: { assetId: 'x', url: 'javascript:alert(1)' },
      }),
    ).toThrow()
  })

  it('rejects ADDON config on a LOGO block', () => {
    expect(() =>
      CreateChannelBlockSchema.parse({
        type: 'LOGO',
        configJson: { addonInstallId: 'abc' },
      }),
    ).toThrow()
  })
})

describe('PatchChannelBlockSchema', () => {
  it('accepts width-only patches', () => {
    expect(PatchChannelBlockSchema.parse({ width: 'THIRD' })).toEqual({ width: 'THIRD' })
  })

  it('rejects an empty patch', () => {
    expect(() => PatchChannelBlockSchema.parse({})).toThrow(/No fields to update/)
  })
})

describe('ReorderChannelBlocksSchema', () => {
  it('accepts a list of ids', () => {
    expect(ReorderChannelBlocksSchema.parse({ ids: ['a', 'b'] })).toEqual({ ids: ['a', 'b'] })
  })

  it('rejects an empty ids list', () => {
    expect(() => ReorderChannelBlocksSchema.parse({ ids: [] })).toThrow()
  })
})
