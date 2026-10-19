// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it } from 'vitest'
import { titleFromFilename } from './upload-title.js'

describe('titleFromFilename', () => {
  it('drops the extension and reads underscores as spaces', () => {
    expect(titleFromFilename('My_Song_v2.wav')).toBe('My Song v2')
  })

  it('keeps dots inside the name', () => {
    expect(titleFromFilename('Live 10.7.26.mp3')).toBe('Live 10.7.26')
  })

  it('ignores any directory part', () => {
    expect(titleFromFilename('C:\\music\\demo.flac')).toBe('demo')
  })

  it('falls back when nothing is left', () => {
    expect(titleFromFilename('.wav')).toBe('Untitled upload')
  })
})
