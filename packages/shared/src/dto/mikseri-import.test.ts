// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it } from 'vitest'
import { MikseriAddTrackRequestSchema } from './mikseri-import.js'

const base = {
  collectionId: 'c1',
  trackUrl: '635878',
  title: 'Song',
  artistName: 'Demo artist',
  rightsConfirmed: true,
}

describe('MikseriAddTrackRequestSchema', () => {
  it('accepts a plain artist name', () => {
    expect(MikseriAddTrackRequestSchema.safeParse(base).success).toBe(true)
  })

  it('rejects an email address as the artist name', () => {
    const result = MikseriAddTrackRequestSchema.safeParse({
      ...base,
      artistName: 'artist@example.com',
    })
    expect(result.success).toBe(false)
  })
})
