// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { CreateReleaseSchema, PatchReleaseSchema } from './release.js'

describe('release DTOs', () => {
  it('accepts valid create payload', () => {
    const parsed = CreateReleaseSchema.safeParse({
      title: 'Midnight EP',
      type: 'EP',
      releaseDate: '2026-01-15',
      tracks: [{ title: 'One', durationSec: 240 }],
    })
    expect(parsed.success).toBe(true)
  })

  it('rejects invalid release type', () => {
    const parsed = CreateReleaseSchema.safeParse({
      title: 'X',
      type: 'MIXTAPE',
      releaseDate: '2026-01-15',
    })
    expect(parsed.success).toBe(false)
  })

  it('rejects unknown smart link service on patch', () => {
    const parsed = PatchReleaseSchema.safeParse({
      smartLinkTargets: { unknown: 'https://example.com' },
    })
    expect(parsed.success).toBe(false)
  })
})
