// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it } from 'vitest'
import {
  archivePlaybackKey,
  chooseLossyOutputBitrateKbps,
  isLosslessCodec,
  isLosslessSource,
  sourceFormatLabel,
} from './archive-playback.js'

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

describe('isLosslessCodec', () => {
  it('detects flac, alac, and pcm streams', () => {
    expect(isLosslessCodec('flac')).toBe(true)
    expect(isLosslessCodec('alac')).toBe(true)
    expect(isLosslessCodec('pcm_s16le')).toBe(true)
  })

  it('rejects lossy codecs and missing values', () => {
    expect(isLosslessCodec('mp3')).toBe(false)
    expect(isLosslessCodec('aac')).toBe(false)
    expect(isLosslessCodec(null)).toBe(false)
  })
})

describe('sourceFormatLabel', () => {
  it('maps codecs to friendly labels', () => {
    expect(sourceFormatLabel('mp3')).toBe('MP3')
    expect(sourceFormatLabel('aac')).toBe('AAC')
    expect(sourceFormatLabel('flac')).toBe('FLAC')
    expect(sourceFormatLabel('alac')).toBe('ALAC')
    expect(sourceFormatLabel('pcm_s16le')).toBe('WAV')
  })

  it('returns null for missing codec', () => {
    expect(sourceFormatLabel(null)).toBe(null)
  })
})

describe('chooseLossyOutputBitrateKbps', () => {
  it('never upscales beyond the source bitrate', () => {
    expect(chooseLossyOutputBitrateKbps(128)).toBe(128)
    expect(chooseLossyOutputBitrateKbps(96)).toBe(96)
  })

  it('never downgrades a higher-bitrate source below 192k default ceiling', () => {
    expect(chooseLossyOutputBitrateKbps(320)).toBe(320)
    expect(chooseLossyOutputBitrateKbps(256)).toBe(256)
  })

  it('caps absurdly high source bitrates at 320k', () => {
    expect(chooseLossyOutputBitrateKbps(1411)).toBe(320)
  })

  it('falls back to 192k when source bitrate is unknown', () => {
    expect(chooseLossyOutputBitrateKbps(null)).toBe(192)
    expect(chooseLossyOutputBitrateKbps(undefined)).toBe(192)
  })

  it('snaps non-standard bitrates down to the nearest standard step', () => {
    expect(chooseLossyOutputBitrateKbps(200)).toBe(192)
    expect(chooseLossyOutputBitrateKbps(140)).toBe(128)
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
