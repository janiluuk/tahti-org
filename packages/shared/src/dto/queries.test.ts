// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { OEmbedQuerySchema, yearFromPathParams } from './queries.js'

describe('query schemas', () => {
  it('parses oEmbed url', () => {
    expect(OEmbedQuerySchema.safeParse({ url: 'https://tahti.live/r/my-release' }).success).toBe(
      true,
    )
  })

  it('rejects invalid grant year path', () => {
    expect(yearFromPathParams({ year: '20xx' })).toBeNull()
    expect(yearFromPathParams({ year: '2026' })).toBe(2026)
  })
})
