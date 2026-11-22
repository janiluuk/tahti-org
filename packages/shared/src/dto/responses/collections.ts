// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

/** Where an item sits in its collection: `position` is the stored order,
 * `trackNumber` the 1-based track number shown for it (the n-th item a
 * viewer can see, in position order). */
export const CollectionTrackOrderItemSchema = z.object({
  id: z.string(),
  position: z.number().int(),
  trackNumber: z.number().int().min(1),
})

export const CollectionPublicViewSchema = z
  .object({
    slug: z.string(),
    name: z.string(),
    isPublic: z.boolean(),
    collaborative: z.boolean(),
    user: z.object({
      username: z.string(),
      displayName: z.string(),
    }),
    links: z.object({
      page: z.string(),
      rss: z.string(),
    }),
    items: z.array(CollectionTrackOrderItemSchema.passthrough()),
  })
  .passthrough()

/** One result row in the public catalog track search (used by the
 * collaborative-playlist "Add track" picker). */
export const CatalogTrackSearchResultSchema = z.object({
  id: z.string(),
  title: z.string(),
  durationSec: z.number().int().nullable(),
  artistName: z.string(),
  channelSlug: z.string(),
})

export const CatalogTrackSearchResponseSchema = z.object({
  tracks: z.array(CatalogTrackSearchResultSchema),
  hasMore: z.boolean(),
})
