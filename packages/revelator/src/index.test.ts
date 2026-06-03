// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { submitReleaseToRevelator } from './index.js'

describe('submitReleaseToRevelator stub mode', () => {
  it('returns a stub id when REVELATOR_API_KEY is unset', async () => {
    const prev = process.env.REVELATOR_API_KEY
    delete process.env.REVELATOR_API_KEY
    const result = await submitReleaseToRevelator({
      tahtiReleaseId: 'rel_1',
      title: 'Test EP',
      type: 'EP',
      releaseDate: '2026-01-01',
      upc: '123',
      pLine: null,
      cLine: null,
      labelImprint: null,
      artistDisplayName: 'Artist',
      artistUsername: 'artist',
      tracks: [{ position: 1, title: 'Track', isrc: 'FI-XXX', durationSec: 200 }],
    })
    expect(result.status).toBe('submitted')
    expect(result.revelatorId).toContain('rel_1')
    if (prev) process.env.REVELATOR_API_KEY = prev
  })
})
