// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it } from 'vitest'
import { shouldShowTracklist, shouldShowVenueLocation } from './sound-editor-visibility.js'

describe('archive editor conditional sections', () => {
  it('shows tracklists only for DJ sets and long-form audio', () => {
    expect(shouldShowTracklist('DJ_SET', 180)).toBe(true)
    expect(shouldShowTracklist('TRACK', 20 * 60)).toBe(true)
    expect(shouldShowTracklist('TRACK', 19 * 60 + 59)).toBe(false)
  })

  it('shows venue fields only for show-like or broadcast recordings', () => {
    expect(shouldShowVenueLocation('DJ_SET')).toBe(true)
    expect(shouldShowVenueLocation('LIVE')).toBe(true)
    expect(shouldShowVenueLocation('SHOW')).toBe(true)
    expect(shouldShowVenueLocation('PODCAST')).toBe(true)
    expect(shouldShowVenueLocation('TRACK', 'BROADCAST')).toBe(true)
    expect(shouldShowVenueLocation('TRACK', 'UPLOAD')).toBe(false)
  })
})
