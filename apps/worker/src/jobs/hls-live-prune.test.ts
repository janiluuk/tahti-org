// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it } from 'vitest'

import { isHlsPrunableObjectKey } from './hls-live-prune.js'

describe('isHlsPrunableObjectKey', () => {
  it('prunes media segments only', () => {
    expect(isHlsPrunableObjectKey('tahti-radio/stream-mp3-192_1.ts')).toBe(true)
    expect(isHlsPrunableObjectKey('tahti-radio/seg.m4s')).toBe(true)
  })

  it('never prunes playlists — master.m3u8 is the public listen URL', () => {
    expect(isHlsPrunableObjectKey('tahti-radio/master.m3u8')).toBe(false)
    expect(isHlsPrunableObjectKey('tahti-radio/master-free.m3u8')).toBe(false)
    expect(isHlsPrunableObjectKey('tahti-radio/stream-mp3-192.m3u8')).toBe(false)
  })
})
