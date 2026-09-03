// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { SOUND_METADATA_DEFAULTS, SoundMetadataFieldsSchema } from './sound-metadata.js'

describe('SoundMetadataFieldsSchema', () => {
  it('accepts full hearthis-style metadata payload', () => {
    const parsed = SoundMetadataFieldsSchema.safeParse({
      genre: 'Techno',
      genreCustom: 'Nordic Techno',
      recordingLocation: 'Helsinki, Finland',
      subGenres: ['peak-time'],
      contentType: 'LIVE',
      mixVersion: 'Original Mix',
      bpm: 128,
      musicalKey: 'Am',
      useDetectedBpmKey: true,
      isAiGenerated: false,
      license: 'CC_BY_NC',
      repostToDownload: false,
      followToDownload: true,
      taggedNote: '@guest-dj',
      slideshowUrls: ['https://cdn.example/cover.jpg'],
    })
    expect(parsed.success).toBe(true)
  })

  it('accepts per-track artist credit override and role credits', () => {
    const parsed = SoundMetadataFieldsSchema.safeParse({
      artistName: 'Guest Alias feat. Friend',
      credits: [
        { role: 'performer', name: 'Guest Alias' },
        { role: 'producer', name: 'Friend', artistUsername: 'friend' },
      ],
    })
    expect(parsed.success).toBe(true)
  })

  it('allows clearing artistName / credits with null', () => {
    const parsed = SoundMetadataFieldsSchema.safeParse({
      artistName: null,
      credits: null,
    })
    expect(parsed.success).toBe(true)
  })

  it('exports sensible defaults', () => {
    expect(SOUND_METADATA_DEFAULTS.genre).toBe('Electronic')
    expect(SOUND_METADATA_DEFAULTS.contentType).toBe('TRACK')
    expect(SOUND_METADATA_DEFAULTS.license).toBe('ALL_RIGHTS_RESERVED')
  })
})
