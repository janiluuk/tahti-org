// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it } from 'vitest'
import {
  countsTowardFlacDownload,
  deriveQualityBadge,
  isEmbedOnlySource,
  playerKindForSource,
} from './quality.js'

describe('quality matrix', () => {
  it('marks the three embed sources as embed-only regardless of hasFlac', () => {
    expect(deriveQualityBadge('SPOTIFY_EMBED', true)).toBe('EMBED_ONLY')
    expect(deriveQualityBadge('MIXCLOUD_EMBED', false)).toBe('EMBED_ONLY')
    expect(deriveQualityBadge('URL_EMBED', true)).toBe('EMBED_ONLY')
  })

  it('Mixcloud rescue is always transcoded — there is no lossless source to recover', () => {
    expect(deriveQualityBadge('MIXCLOUD_RESCUE', true)).toBe('TRANSCODED')
    expect(deriveQualityBadge('MIXCLOUD_RESCUE', false)).toBe('TRANSCODED')
  })

  it('upload/bandcamp/google_drive/broadcast/soundcloud follow hasFlac', () => {
    for (const source of [
      'UPLOAD',
      'BANDCAMP',
      'GOOGLE_DRIVE',
      'BROADCAST',
      'SOUNDCLOUD',
    ] as const) {
      expect(deriveQualityBadge(source, true)).toBe('LOSSLESS')
      expect(deriveQualityBadge(source, false)).toBe('TRANSCODED')
    }
  })

  it('isEmbedOnlySource matches exactly the three embed sources', () => {
    expect(isEmbedOnlySource('SPOTIFY_EMBED')).toBe(true)
    expect(isEmbedOnlySource('MIXCLOUD_EMBED')).toBe(true)
    expect(isEmbedOnlySource('URL_EMBED')).toBe(true)
    expect(isEmbedOnlySource('UPLOAD')).toBe(false)
    expect(isEmbedOnlySource('MIXCLOUD_RESCUE')).toBe(false)
  })

  it('playerKindForSource routes embeds to their provider, everything else to Tahti', () => {
    expect(playerKindForSource('SPOTIFY_EMBED')).toBe('SPOTIFY_EMBED')
    expect(playerKindForSource('MIXCLOUD_EMBED')).toBe('MIXCLOUD_EMBED')
    expect(playerKindForSource('URL_EMBED')).toBe('GENERIC_EMBED')
    expect(playerKindForSource('UPLOAD')).toBe('TAHTI')
    expect(playerKindForSource('MIXCLOUD_RESCUE')).toBe('TAHTI')
  })

  it('only LOSSLESS counts toward the FLAC download bundle', () => {
    expect(countsTowardFlacDownload('LOSSLESS')).toBe(true)
    expect(countsTowardFlacDownload('TRANSCODED')).toBe(false)
    expect(countsTowardFlacDownload('EMBED_ONLY')).toBe(false)
  })
})
