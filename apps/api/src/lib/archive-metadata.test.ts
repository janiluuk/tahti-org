// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { effectiveBpm, effectiveKey, metadataForNewUpload } from './archive-metadata.js'

describe('archive-metadata', () => {
  it('prefers detected BPM/key when useDetectedBpmKey is true', () => {
    expect(effectiveBpm({ bpm: 120, bpmDetected: 128, useDetectedBpmKey: true })).toBe(128)
    expect(effectiveKey({ musicalKey: 'C', keyDetected: 'Am', useDetectedBpmKey: true })).toBe('Am')
  })

  it('uses manual BPM/key when useDetectedBpmKey is false', () => {
    expect(effectiveBpm({ bpm: 120, bpmDetected: 128, useDetectedBpmKey: false })).toBe(120)
    expect(effectiveKey({ musicalKey: 'C', keyDetected: 'Am', useDetectedBpmKey: false })).toBe('C')
  })

  it('metadataForNewUpload applies hearthis-style defaults', () => {
    const data = metadataForNewUpload({})
    expect(data.contentType).toBe('STUDIO')
    expect(data.genre).toBe('Electronic')
    expect(data.license).toBe('ALL_RIGHTS_RESERVED')
    expect(data.useDetectedBpmKey).toBe(true)
    expect(data.isAiGenerated).toBe(false)
    expect(data.repostToDownload).toBe(false)
    expect(data.isPublic).toBe(true)
    expect(data.releasedAt).toBeInstanceOf(Date)
  })

  it('metadataForNewUpload merges artist-provided fields', () => {
    const data = metadataForNewUpload({
      contentType: 'DJ_MIX',
      recordingLocation: 'Helsinki, Finland',
      repostToDownload: true,
    })
    expect(data.contentType).toBe('DJ_MIX')
    expect(data.recordingLocation).toBe('Helsinki, Finland')
    expect(data.repostToDownload).toBe(true)
  })
})
