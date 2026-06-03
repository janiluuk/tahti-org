// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { ARCHIVE_METADATA_DEFAULTS, ArchiveMetadataFieldsSchema } from './archive-metadata.js'

describe('ArchiveMetadataFieldsSchema', () => {
  it('accepts full hearthis-style metadata payload', () => {
    const parsed = ArchiveMetadataFieldsSchema.safeParse({
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

  it('exports sensible defaults', () => {
    expect(ARCHIVE_METADATA_DEFAULTS.genre).toBe('Electronic')
    expect(ARCHIVE_METADATA_DEFAULTS.contentType).toBe('STUDIO')
    expect(ARCHIVE_METADATA_DEFAULTS.license).toBe('ALL_RIGHTS_RESERVED')
  })
})
