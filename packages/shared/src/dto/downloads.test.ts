// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { SoundDownloadQuerySchema, ReleaseDownloadQuerySchema } from './downloads.js'

describe('download query schemas', () => {
  it('accepts known formats', () => {

    expect(SoundDownloadQuerySchema.safeParse({ format: 'flac' }).success).toBe(true)
    expect(SoundDownloadQuerySchema.safeParse({ format: 'source' }).success).toBe(true)
  })

  it('rejects unknown format', () => {
    expect(SoundDownloadQuerySchema.safeParse({ format: 'wav' }).success).toBe(false)
  })

  it('accepts source format on release downloads', () => {
    expect(ReleaseDownloadQuerySchema.safeParse({ format: 'source' }).success).toBe(true)
  })
})
