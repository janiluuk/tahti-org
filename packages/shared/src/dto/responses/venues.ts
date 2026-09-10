// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const VenueBroadcastCalendarSchema = z.object({
  venue: z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
  }),
  broadcasts: z.array(z.unknown()),
})

export const VenueDirectoryEntrySchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  city: z.string(),
  countryCode: z.string().nullable(),
  capacity: z.number().int().nullable(),
  description: z.string().nullable(),
})

export const VenueDirectoryListSchema = z.array(VenueDirectoryEntrySchema)

export const VenuePublicProfileSchema = z
  .object({
    id: z.string(),
    slug: z.string(),
    name: z.string(),
    broadcasts: z.array(z.unknown()),
  })
  .passthrough()
