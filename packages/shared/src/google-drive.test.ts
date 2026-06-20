// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it } from 'vitest'
import {
  extensionFromDriveFile,
  isAllowedDriveAudioMime,
  titleFromDriveFileName,
} from './google-drive.js'

describe('google-drive helpers', () => {
  it('accepts audio mime types and common extensions', () => {
    expect(isAllowedDriveAudioMime('audio/flac', 'set.flac')).toBe(true)
    expect(isAllowedDriveAudioMime(undefined, 'mix.mp3')).toBe(true)
    expect(isAllowedDriveAudioMime('application/pdf', 'readme.pdf')).toBe(false)
  })

  it('derives title without extension', () => {
    expect(titleFromDriveFileName('Midnight Run.flac')).toBe('Midnight Run')
  })

  it('maps mime and filename to storage extension', () => {
    expect(extensionFromDriveFile('track.flac', 'audio/flac')).toBe('flac')
    expect(extensionFromDriveFile('track', 'audio/mpeg')).toBe('mp3')
  })
})
