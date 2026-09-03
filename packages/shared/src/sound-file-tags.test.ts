// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it } from 'vitest'
import {
  frequencyToPitchClass,
  mergeDetectedSoundMetadata,
  mergeParsedSoundTags,
  parseSoundFileTags,
} from './sound-file-tags.js'

describe('parseSoundFileTags', () => {
  it('reads BPM and key from common tag names', () => {
    const tags = parseSoundFileTags({ TBPM: '128', TKEY: 'Am' })
    expect(tags.bpm).toBe(128)
    expect(tags.key).toBe('Am')
  })

  it('reads genre and comment', () => {
    const tags = parseSoundFileTags({
      TCON: 'Techno',
      comment: 'Recorded live at Klubi',
    })
    expect(tags.genre).toBe('Techno')
    expect(tags.description).toBe('Recorded live at Klubi')
  })
})

describe('mergeParsedSoundTags', () => {
  it('keeps embedded BPM/key over acoustic', () => {
    const merged = mergeParsedSoundTags(
      {
        bpm: 128,
        key: 'Am',
        genre: null,
        description: null,
        recordingLocation: null,
        mixVersion: null,
      },
      { bpm: 120, key: 'C' },
    )
    expect(merged.bpm).toBe(128)
    expect(merged.key).toBe('Am')
  })

  it('fills missing BPM/key from acoustic', () => {
    const merged = mergeParsedSoundTags(
      {
        bpm: null,
        key: null,
        genre: null,
        description: null,
        recordingLocation: null,
        mixVersion: null,
      },
      { bpm: 126, key: 'F#' },
    )
    expect(merged.bpm).toBe(126)
    expect(merged.key).toBe('F#')
  })
})

describe('frequencyToPitchClass', () => {
  it('maps A440 to A', () => {
    expect(frequencyToPitchClass(440)).toBe('A')
  })
})

describe('mergeDetectedSoundMetadata', () => {
  const emptyItem = {
    description: null,
    genre: 'Electronic',
    genreCustom: null,
    recordingLocation: null,
    mixVersion: null,
    useDetectedBpmKey: true,
  }

  it('fills empty fields when auto tags enabled', () => {
    const patch = mergeDetectedSoundMetadata(emptyItem, {
      bpm: 128,
      key: 'Am',
      genre: 'Techno',
      description: 'Live set',
      recordingLocation: 'Helsinki',
      mixVersion: 'Extended',
    })
    expect(patch.description).toBe('Live set')
    expect(patch.genre).toBe('Techno')
    expect(patch.recordingLocation).toBe('Helsinki')
    expect(patch.mixVersion).toBe('Extended')
  })

  it('maps unknown genre to genreCustom', () => {
    const patch = mergeDetectedSoundMetadata(emptyItem, {
      bpm: null,
      key: null,
      genre: 'Deep Hypnotic',
      description: null,
      recordingLocation: null,
      mixVersion: null,
    })
    expect(patch.genreCustom).toBe('Deep Hypnotic')
    expect(patch.genre).toBeUndefined()
  })

  it('does not override artist-provided fields', () => {
    const patch = mergeDetectedSoundMetadata(
      {
        ...emptyItem,
        description: 'My notes',
        genre: 'House',
        genreCustom: null,
      },
      {
        bpm: null,
        key: null,
        genre: 'Techno',
        description: 'From file',
        recordingLocation: null,
        mixVersion: null,
      },
    )
    expect(patch).toEqual({})
  })

  it('returns nothing when artist disabled auto tags', () => {
    const patch = mergeDetectedSoundMetadata(
      { ...emptyItem, useDetectedBpmKey: false },
      {
        bpm: 128,
        key: 'Am',
        genre: 'Techno',
        description: 'Live',
        recordingLocation: null,
        mixVersion: null,
      },
    )
    expect(patch).toEqual({})
  })
})
