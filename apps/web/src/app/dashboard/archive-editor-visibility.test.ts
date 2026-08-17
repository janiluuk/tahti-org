import { describe, expect, it } from 'vitest'
import { shouldShowTracklist, shouldShowVenueLocation } from './archive-editor-visibility.js'

describe('archive editor conditional sections', () => {
  it('shows tracklists only for DJ sets and long-form audio', () => {
    expect(shouldShowTracklist('DJ_MIX', 180)).toBe(true)
    expect(shouldShowTracklist('STUDIO', 20 * 60)).toBe(true)
    expect(shouldShowTracklist('STUDIO', 19 * 60 + 59)).toBe(false)
  })

  it('shows venue fields only for show-like or broadcast recordings', () => {
    expect(shouldShowVenueLocation('DJ_MIX')).toBe(true)
    expect(shouldShowVenueLocation('LIVE')).toBe(true)
    expect(shouldShowVenueLocation('RADIO_SHOW')).toBe(true)
    expect(shouldShowVenueLocation('PODCAST')).toBe(true)
    expect(shouldShowVenueLocation('STUDIO', 'BROADCAST')).toBe(true)
    expect(shouldShowVenueLocation('STUDIO', 'UPLOAD')).toBe(false)
  })
})
