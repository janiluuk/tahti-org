// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { ArchiveDownloadQuerySchema, ReleaseDownloadQuerySchema } from './downloads.js'

describe('download query schemas', () => {
  it('accepts known formats', () => {
    expect(ArchiveDownloadQuerySchema.safeParse({ format: 'flac' }).success).toBe(true)
  })

  it('rejects unknown format', () => {
    expect(ArchiveDownloadQuerySchema.safeParse({ format: 'wav' }).success).toBe(false)
  })

  it('accepts source format on release downloads', () => {
    expect(ReleaseDownloadQuerySchema.safeParse({ format: 'source' }).success).toBe(true)
  })
})
