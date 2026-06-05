// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it } from 'vitest'
import { BetaApplySchema, normalizeBetaApplyLinks } from './beta-apply.js'

describe('normalizeBetaApplyLinks', () => {
  it('joins multiple URLs with newlines', () => {
    expect(normalizeBetaApplyLinks(['https://soundcloud.com/a', 'https://bandcamp.com/b'])).toBe(
      'https://soundcloud.com/a\nhttps://bandcamp.com/b',
    )
  })

  it('deduplicates and drops empty entries', () => {
    expect(
      normalizeBetaApplyLinks([' https://a.test ', '', 'https://a.test', 'https://b.test']),
    ).toBe('https://a.test\nhttps://b.test')
  })
})

describe('BetaApplySchema links', () => {
  const base = {
    name: 'DJ Test',
    email: 'test@example.com',
    artistType: 'DJ',
  }

  it('accepts a links array from the apply form', () => {
    const parsed = BetaApplySchema.parse({
      ...base,
      links: ['https://soundcloud.com/x', 'https://mixcloud.com/y'],
    })
    expect(parsed.links).toBe('https://soundcloud.com/x\nhttps://mixcloud.com/y')
  })

  it('accepts legacy single-string links', () => {
    const parsed = BetaApplySchema.parse({
      ...base,
      links: 'https://soundcloud.com/x',
    })
    expect(parsed.links).toBe('https://soundcloud.com/x')
  })
})
