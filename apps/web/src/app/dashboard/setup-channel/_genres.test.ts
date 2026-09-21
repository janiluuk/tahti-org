// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { MAX_GENRES, toggleGenre } from './_genres'

describe('toggleGenre', () => {
  it('adds and removes', () => {
    expect(toggleGenre([], 'Jazz')).toEqual(['Jazz'])
    expect(toggleGenre(['Jazz', 'Rock'], 'Jazz')).toEqual(['Rock'])
  })
  it('caps the selection', () => {
    const full = Array.from({ length: MAX_GENRES }, (_, i) => `G${i}`)
    expect(toggleGenre(full, 'Extra')).toEqual(full)
  })
})
