// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import {
  SoundBulkDeleteSchema,
  SoundBulkPatchSchema,
  SoundFacetsQuerySchema,
  SoundListQuerySchema,
} from './sound-metadata.js'

describe('SoundListQuerySchema', () => {
  it('accepts paging and filters from string query values', () => {
    const parsed = SoundListQuerySchema.parse({
      limit: '25',
      offset: '50',
      q: 'house',
      isPublic: 'true',
      pinned: '0',
      bpmMin: '120',
      bpmMax: '128',
      sort: 'title',
    })
    expect(parsed).toMatchObject({
      limit: 25,
      offset: 50,
      q: 'house',
      isPublic: true,
      pinned: false,
      bpmMin: 120,
      bpmMax: 128,
      sort: 'title',
    })
  })

  it('rejects an oversized limit', () => {
    expect(() => SoundListQuerySchema.parse({ limit: '500' })).toThrow()
  })

  it('parses tags as a comma-separated AND list', () => {
    expect(SoundListQuerySchema.parse({ tags: 'deep,house' }).tags).toEqual(['deep', 'house'])
    expect(SoundListQuerySchema.parse({ tag: 'solo' }).tag).toBe('solo')
  })
})

describe('SoundFacetsQuerySchema', () => {
  it('splits a comma-separated fields list', () => {
    const parsed = SoundFacetsQuerySchema.parse({ fields: 'genre,tag,status' })
    expect(parsed.fields).toEqual(['genre', 'tag', 'status'])
  })
})

describe('SoundBulkDeleteSchema', () => {
  it('requires exactly one of ids or filter', () => {
    expect(SoundBulkDeleteSchema.safeParse({}).success).toBe(false)
    expect(
      SoundBulkDeleteSchema.safeParse({ ids: ['a'], filter: { q: 'x' }, confirmTotal: 1 }).success,
    ).toBe(false)
    expect(SoundBulkDeleteSchema.safeParse({ ids: ['a'] }).success).toBe(true)
    expect(SoundBulkDeleteSchema.safeParse({ filter: { q: 'x' }, confirmTotal: 1 }).success).toBe(
      true,
    )
  })
})

describe('SoundBulkPatchSchema', () => {
  it('requires a non-empty patch', () => {
    expect(SoundBulkPatchSchema.safeParse({ ids: ['a'], patch: {} }).success).toBe(false)
    expect(
      SoundBulkPatchSchema.safeParse({
        ids: ['a'],
        patch: { genre: 'House', isPublic: true },
      }).success,
    ).toBe(true)
  })

  it('allows tags: [] to clear tags and pinned boolean', () => {
    expect(
      SoundBulkPatchSchema.safeParse({
        ids: ['a'],
        patch: { tags: [] },
      }).success,
    ).toBe(true)
    expect(
      SoundBulkPatchSchema.safeParse({
        ids: ['a'],
        patch: { pinned: true },
      }).success,
    ).toBe(true)
  })
})
