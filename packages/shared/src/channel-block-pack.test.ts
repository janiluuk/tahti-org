// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it } from 'vitest'
import { packChannelBlocks, type ChannelBlockWidth } from './channel-block-pack.js'

function blocks(...widths: ChannelBlockWidth[]): Array<{ id: string; width: ChannelBlockWidth }> {
  return widths.map((width, i) => ({ id: String(i), width }))
}

function packed(...widths: ChannelBlockWidth[]): string[][] {
  return packChannelBlocks(blocks(...widths)).map((row) => row.map((b) => b.width))
}

describe('packChannelBlocks', () => {
  it('returns no rows for an empty list', () => {
    expect(packChannelBlocks([])).toEqual([])
  })

  it('puts FULL alone on a row', () => {
    expect(packed('FULL')).toEqual([['FULL']])
  })

  it('packs HALF + HALF onto one row', () => {
    expect(packed('HALF', 'HALF')).toEqual([['HALF', 'HALF']])
  })

  it('packs THIRD + THIRD + THIRD onto one row', () => {
    expect(packed('THIRD', 'THIRD', 'THIRD')).toEqual([['THIRD', 'THIRD', 'THIRD']])
  })

  it('leaves leftover space unfilled (HALF + THIRD)', () => {
    expect(packed('HALF', 'THIRD')).toEqual([['HALF', 'THIRD']])
  })

  it('does not pull the next HALF into a leftover-THIRD row', () => {
    expect(packed('THIRD', 'THIRD', 'HALF')).toEqual([['THIRD', 'THIRD'], ['HALF']])
  })

  it('starts a new row after FULL', () => {
    expect(packed('FULL', 'HALF')).toEqual([['FULL'], ['HALF']])
  })

  it('wraps a third HALF onto the next row', () => {
    expect(packed('HALF', 'HALF', 'HALF')).toEqual([['HALF', 'HALF'], ['HALF']])
  })

  it('keeps input order inside each row', () => {
    const rows = packChannelBlocks([
      { id: 'a', width: 'THIRD' as const },
      { id: 'b', width: 'THIRD' as const },
      { id: 'c', width: 'THIRD' as const },
    ])
    expect(rows).toEqual([
      [
        { id: 'a', width: 'THIRD' },
        { id: 'b', width: 'THIRD' },
        { id: 'c', width: 'THIRD' },
      ],
    ])
  })
})
