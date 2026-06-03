// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import {
  CollectionListQuerySchema,
  MeReleaseTrackDownloadQuerySchema,
  OEmbedQuerySchema,
  VenueCalendarQuerySchema,
  yearFromPathParams,
} from './queries.js'

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

  it('parses collection expand query', () => {
    expect(CollectionListQuerySchema.safeParse({ expand: 'items' }).success).toBe(true)
    expect(CollectionListQuerySchema.safeParse({ expand: 'nope' }).success).toBe(false)
  })

  it('parses venue calendar range', () => {
    expect(
      VenueCalendarQuerySchema.safeParse({
        from: '2026-01-01T00:00:00.000Z',
        to: '2026-12-31T23:59:59.000Z',
      }).success,
    ).toBe(true)
    expect(VenueCalendarQuerySchema.safeParse({ from: 'not-a-date' }).success).toBe(false)
  })

  it('parses me release track download format', () => {
    expect(MeReleaseTrackDownloadQuerySchema.safeParse({ format: 'flac' }).success).toBe(true)
    expect(MeReleaseTrackDownloadQuerySchema.safeParse({ format: 'wav' }).success).toBe(false)
  })
})
