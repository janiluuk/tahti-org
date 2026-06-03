// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { ChannelArchiveParamsSchema, parseRouteParams, SlugParamSchema } from './params.js'

describe('route param schemas', () => {
  it('parses channel archive params', () => {
    const parsed = parseRouteParams(ChannelArchiveParamsSchema, {
      slug: 'my-channel',
      itemId: 'clxyz123',
    })
    expect(parsed).toEqual({ slug: 'my-channel', itemId: 'clxyz123' })
  })

  it('rejects empty slug', () => {
    expect(SlugParamSchema.safeParse({ slug: '' }).success).toBe(false)
  })
})
