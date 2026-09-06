// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it } from 'vitest'
import { channelPlaylistLabel } from './channel-controls-label.js'

describe('channelPlaylistLabel', () => {
  it('returns the active playlist name', () => {
    expect(
      channelPlaylistLabel([
        { name: 'Archive', active: false },
        { name: 'Night Drive', active: true },
      ]),
    ).toBe('Night Drive')
  })

  it('falls back to Default rotation when none is active', () => {
    expect(channelPlaylistLabel([{ name: 'Archive', active: false }])).toBe('Default rotation')
    expect(channelPlaylistLabel([])).toBe('Default rotation')
  })
})
