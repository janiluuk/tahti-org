// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it } from 'vitest'
import { archivePlaybackKey, isLosslessSource } from './archive-playback.js'

describe('isLosslessSource', () => {
  it('detects wav, flac, and aiff', () => {
    expect(isLosslessSource('wav')).toBe(true)
    expect(isLosslessSource('flac')).toBe(true)
    expect(isLosslessSource('aiff')).toBe(true)
  })

  it('rejects lossy formats', () => {
    expect(isLosslessSource('mp3')).toBe(false)
    expect(isLosslessSource('aac')).toBe(false)
    expect(isLosslessSource('ogg')).toBe(false)
  })
})

describe('archivePlaybackKey', () => {
  it('prefers mp3 when both exist', () => {
    expect(archivePlaybackKey({ mp3Key: 'a.mp3', flacKey: 'a.flac' })).toBe('a.mp3')
  })

  it('uses flac when mp3 is absent', () => {
    expect(archivePlaybackKey({ mp3Key: null, flacKey: 'a.flac' })).toBe('a.flac')
  })

  it('returns null when neither exists', () => {
    expect(archivePlaybackKey({ mp3Key: null, flacKey: null })).toBe(null)
  })
})
