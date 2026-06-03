// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { orderFallbackPool, selectFallbackPool } from './fallback-playlist.js'

const base = {
  mp3Key: 'mp3/a.mp3',
  flacKey: null as string | null,
  durationSec: 100,
}

describe('fallback-playlist', () => {
  it('uses isFallback subset when any item is flagged', () => {
    const pool = selectFallbackPool([
      {
        id: 'a',
        title: 'A',
        isFallback: true,
        fallbackOrder: null,
        lastFallbackPlayedAt: null,
        ...base,
      },
      {
        id: 'b',
        title: 'B',
        isFallback: false,
        fallbackOrder: null,
        lastFallbackPlayedAt: null,
        ...base,
      },
    ])
    expect(pool.map((i) => i.id)).toEqual(['a'])
  })

  it('falls back to all playable items when none flagged', () => {
    const pool = selectFallbackPool([
      {
        id: 'a',
        title: 'A',
        isFallback: false,
        fallbackOrder: null,
        lastFallbackPlayedAt: null,
        ...base,
      },
      {
        id: 'b',
        title: 'B',
        isFallback: false,
        fallbackOrder: null,
        lastFallbackPlayedAt: null,
        ...base,
      },
    ])
    expect(pool).toHaveLength(2)
  })

  it('orders by fallbackOrder in ordered mode', () => {
    const ordered = orderFallbackPool(
      [
        {
          id: 'late',
          title: 'Late',
          isFallback: true,
          fallbackOrder: 2,
          lastFallbackPlayedAt: null,
          ...base,
        },
        {
          id: 'first',
          title: 'First',
          isFallback: true,
          fallbackOrder: 0,
          lastFallbackPlayedAt: null,
          ...base,
        },
      ],
      'ordered',
    )
    expect(ordered.map((i) => i.id)).toEqual(['first', 'late'])
  })

  it('sorts shuffle by oldest lastFallbackPlayedAt first', () => {
    const ordered = orderFallbackPool(
      [
        {
          id: 'recent',
          title: 'Recent',
          isFallback: true,
          fallbackOrder: null,
          lastFallbackPlayedAt: new Date('2026-06-01'),
          ...base,
        },
        {
          id: 'stale',
          title: 'Stale',
          isFallback: true,
          fallbackOrder: null,
          lastFallbackPlayedAt: new Date('2026-01-01'),
          ...base,
        },
        {
          id: 'never',
          title: 'Never',
          isFallback: true,
          fallbackOrder: null,
          lastFallbackPlayedAt: null,
          ...base,
        },
      ],
      'shuffle',
    )
    expect(ordered.map((i) => i.id)).toEqual(['never', 'stale', 'recent'])
  })
})
