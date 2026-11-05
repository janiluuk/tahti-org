// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it } from 'vitest'
import { sniffAudioContainer } from './audio-sniff.js'

const bytes = (...parts: Array<string | number[]>) =>
  Uint8Array.from(
    parts.flatMap((p) => (typeof p === 'string' ? [...p].map((c) => c.charCodeAt(0)) : p)),
  )

describe('sniffAudioContainer', () => {
  it('recognises the audio containers people upload', () => {
    expect(sniffAudioContainer(bytes('ID3', [4, 0, 0]))).toBe('mp3')
    expect(sniffAudioContainer(bytes([0xff, 0xfb, 0x90, 0x64]))).toBe('mp3')
    expect(sniffAudioContainer(bytes([0xff, 0xf1, 0x50, 0x80]))).toBe('aac')
    expect(sniffAudioContainer(bytes('fLaC', [0, 0, 0, 34]))).toBe('flac')
    expect(sniffAudioContainer(bytes('RIFF', [0, 0, 0, 0], 'WAVEfmt '))).toBe('wav')
    expect(sniffAudioContainer(bytes('OggS', [0]))).toBe('ogg')
    expect(sniffAudioContainer(bytes([0, 0, 0, 32], 'ftypM4A '))).toBe('mp4')
    expect(sniffAudioContainer(bytes('FORM', [0, 0, 0, 0], 'AIFF'))).toBe('aiff')
    expect(sniffAudioContainer(bytes([0x1a, 0x45, 0xdf, 0xa3]))).toBe('matroska')
  })

  it('rejects files that are not audio', () => {
    expect(sniffAudioContainer(bytes('%PDF-1.7'))).toBeNull()
    expect(sniffAudioContainer(bytes([0x89], 'PNG'))).toBeNull()
    expect(sniffAudioContainer(bytes('PK', [3, 4]))).toBeNull()
    expect(sniffAudioContainer(bytes('RIFF', [0, 0, 0, 0], 'AVI '))).toBeNull()
    expect(sniffAudioContainer(bytes('<!doctype html>'))).toBeNull()
    expect(sniffAudioContainer(new Uint8Array())).toBeNull()
  })
})
