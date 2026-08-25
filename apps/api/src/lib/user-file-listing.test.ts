// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { computeRunningTotals, isAudioStashFile } from './user-file-listing.js'

describe('isAudioStashFile', () => {
  it('treats an audio/* contentType as audio', () => {
    expect(isAudioStashFile({ contentType: 'audio/wav', format: null })).toBe(true)
    expect(isAudioStashFile({ contentType: 'AUDIO/FLAC', format: null })).toBe(true)
  })

  it('treats a known audio format extension as audio even with a generic contentType', () => {
    expect(isAudioStashFile({ contentType: 'application/octet-stream', format: 'FLAC' })).toBe(true)
    expect(isAudioStashFile({ contentType: 'application/octet-stream', format: 'mp3' })).toBe(true)
  })

  it('is false for non-audio content', () => {
    expect(isAudioStashFile({ contentType: 'application/zip', format: 'ZIP' })).toBe(false)
    expect(isAudioStashFile({ contentType: 'image/png', format: null })).toBe(false)
  })
})

describe('computeRunningTotals', () => {
  it('accumulates sizes in input order', () => {
    expect(computeRunningTotals([100, 200, 300])).toEqual([100, 300, 600])
  })

  it('treats null sizes as zero without breaking the running total', () => {
    expect(computeRunningTotals([100, null, 200])).toEqual([100, 100, 300])
  })

  it('returns an empty array for no files', () => {
    expect(computeRunningTotals([])).toEqual([])
  })
})
