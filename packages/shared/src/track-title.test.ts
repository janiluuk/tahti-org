// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it } from 'vitest'
import { trackTitleFromFilename } from './track-title.js'

describe('trackTitleFromFilename', () => {
  it.each([
    ['01 Midnight Run.mp3', 'Midnight Run'],
    ['01. Midnight Run.mp3', 'Midnight Run'],
    ['1 - Midnight Run.flac', 'Midnight Run'],
    ['12) Midnight Run.wav', 'Midnight Run'],
    ['03_Midnight_Run.wav', 'Midnight Run'],
    ['Midnight Run (1).mp3', 'Midnight Run'],
    ['Midnight Run [www.example.com].mp3', 'Midnight Run'],
    ['C:\\music\\Midnight Run.flac', 'Midnight Run'],
  ])('cleans %s', (filename, title) => {
    expect(trackTitleFromFilename(filename)).toBe(title)
  })

  it('drops the uploader’s own name in either order with the track number', () => {
    const artistNames = ['DJ Example', 'djexample']
    expect(trackTitleFromFilename('DJ Example - Midnight Run.mp3', { artistNames })).toBe(
      'Midnight Run',
    )
    expect(trackTitleFromFilename('02 - djexample - Midnight Run.mp3', { artistNames })).toBe(
      'Midnight Run',
    )
    expect(trackTitleFromFilename('dj example - 04 - Midnight Run.mp3', { artistNames })).toBe(
      'Midnight Run',
    )
  })

  it('keeps names that only look like leftovers', () => {
    expect(trackTitleFromFilename('99 Luftballons.mp3')).toBe('99 Luftballons')
    expect(trackTitleFromFilename('1999.mp3')).toBe('1999')
    expect(trackTitleFromFilename('Live 10.7.26')).toBe('Live 10.7.26')
    expect(trackTitleFromFilename('Other Artist - Midnight Run.mp3')).toBe(
      'Other Artist - Midnight Run',
    )
    expect(trackTitleFromFilename('1-800 Call.mp3')).toBe('1-800 Call')
  })

  it('falls back to the file name when cleaning leaves nothing', () => {
    expect(trackTitleFromFilename('01.mp3')).toBe('01')
    expect(trackTitleFromFilename('.wav')).toBe('')
  })
})
