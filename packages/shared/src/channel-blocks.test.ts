// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { packBlocks } from './channel-blocks.js'
import type { ChannelBlockWidthInput } from './dto/channel-blocks.js'

type Block = { id: string; width: ChannelBlockWidthInput }

function block(id: string, width: ChannelBlockWidthInput): Block {
  return { id, width }
}

function ids(rows: Block[][]): string[][] {
  return rows.map((row) => row.map((b) => b.id))
}

describe('packBlocks', () => {
  it('returns an empty list for no blocks', () => {
    expect(packBlocks([])).toEqual([])
  })

  it('puts each FULL block alone in its own row', () => {
    const rows = packBlocks([block('a', 'FULL'), block('b', 'FULL')])
    expect(ids(rows)).toEqual([['a'], ['b']])
  })

  it('packs two HALFs into one row', () => {
    const rows = packBlocks([block('a', 'HALF'), block('b', 'HALF')])
    expect(ids(rows)).toEqual([['a', 'b']])
  })

  it('starts a new row once a HALF row already has two', () => {
    const rows = packBlocks([block('a', 'HALF'), block('b', 'HALF'), block('c', 'HALF')])
    expect(ids(rows)).toEqual([['a', 'b'], ['c']])
  })

  it('packs three THIRDs into one row', () => {
    const rows = packBlocks([block('a', 'THIRD'), block('b', 'THIRD'), block('c', 'THIRD')])
    expect(ids(rows)).toEqual([['a', 'b', 'c']])
  })

  it('leaves a THIRD row with leftover space unfilled instead of waiting for a match', () => {
    const rows = packBlocks([block('a', 'THIRD'), block('b', 'THIRD'), block('c', 'FULL')])
    expect(ids(rows)).toEqual([['a', 'b'], ['c']])
  })

  it('closes the current row immediately when width changes mid-row', () => {
    const rows = packBlocks([
      block('a', 'HALF'),
      block('b', 'THIRD'),
      block('c', 'THIRD'),
      block('d', 'THIRD'),
    ])
    expect(ids(rows)).toEqual([['a'], ['b', 'c', 'd']])
  })

  it('preserves input order within and across rows', () => {
    const rows = packBlocks([
      block('a', 'FULL'),
      block('b', 'HALF'),
      block('c', 'HALF'),
      block('d', 'THIRD'),
      block('e', 'THIRD'),
    ])
    expect(ids(rows)).toEqual([['a'], ['b', 'c'], ['d', 'e']])
  })
})
