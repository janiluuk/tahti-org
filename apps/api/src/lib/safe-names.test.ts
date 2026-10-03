// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { trackArtistName, userName } from './safe-names.js'

const owner = (displayName: string) => ({ username: 'owner', displayName })

describe('userName', () => {
  it('falls back to the username for an email display name', () => {
    expect(userName(owner('Owner'))).toBe('Owner')
    expect(userName(owner('owner@example.com'))).toBe('owner')
  })
})

describe('trackArtistName', () => {
  it('prefers the track artist name', () => {
    expect(trackArtistName({ artistName: 'Guest', channel: { user: owner('Owner') } })).toBe(
      'Guest',
    )
  })

  it('falls back to the safe owner name when the artist name is missing, blank or an email', () => {
    for (const artistName of [null, '  ', 'guest@example.com']) {
      expect(trackArtistName({ artistName, channel: { user: owner('Owner') } })).toBe('Owner')
      expect(trackArtistName({ artistName, channel: { user: owner('owner@example.com') } })).toBe(
        'owner',
      )
    }
  })
})
