// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import {
  ArchiveVersionParamsSchema,
  ChannelArchiveParamsSchema,
  ReleaseIdTrackIdParamsSchema,
  ReleaseTrackDownloadParamsSchema,
  ReleaseTrackParamsSchema,
  SmartLinkSlugParamSchema,
  parseRouteParams,
  SlugParamSchema,
} from './params.js'

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

  it('parses release track download params', () => {
    expect(
      parseRouteParams(ReleaseTrackDownloadParamsSchema, {
        smartLinkSlug: 'my-release',
        trackId: 'trk1',
      }),
    ).toEqual({ smartLinkSlug: 'my-release', trackId: 'trk1' })
  })

  it('parses release track params', () => {
    expect(parseRouteParams(ReleaseTrackParamsSchema, { id: 'rel1', trackId: 'trk1' })).toEqual({
      id: 'rel1',
      trackId: 'trk1',
    })
  })

  it('parses release id + track id params', () => {
    expect(
      parseRouteParams(ReleaseIdTrackIdParamsSchema, { releaseId: 'rel1', trackId: 'trk1' }),
    ).toEqual({ releaseId: 'rel1', trackId: 'trk1' })
  })

  it('parses smart link slug', () => {
    expect(parseRouteParams(SmartLinkSlugParamSchema, { smartLinkSlug: 'ep-2026' })).toEqual({
      smartLinkSlug: 'ep-2026',
    })
  })

  it('parses archive version params', () => {
    expect(
      parseRouteParams(ArchiveVersionParamsSchema, { id: 'item1', versionId: 'ver1' }),
    ).toEqual({ id: 'item1', versionId: 'ver1' })
  })
})
