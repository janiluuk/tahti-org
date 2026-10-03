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
  /** Promo photos, profile order; the directory card shows one of them. */
  photos: z.array(z.string()),
})

export const VenueDirectoryListSchema = z.array(VenueDirectoryEntrySchema)

/** A public track recorded at the venue (Sound.venueId). */
export const VenueRecordingSchema = z.object({
  id: z.string(),
  title: z.string(),
  artistName: z.string(),
  channelSlug: z.string(),
  durationSec: z.number().int().nullable(),
  coverUrl: z.string().nullable(),
  releasedAt: z.string(),
})

export const VenuePublicProfileSchema = z
  .object({
    id: z.string(),
    slug: z.string(),
    name: z.string(),
    broadcasts: z.array(z.unknown()),
    /** Public, ready tracks recorded here, newest first, at most
     * VENUE_RECORDINGS_LIMIT. */
    recordings: z.array(VenueRecordingSchema),
  })
  .passthrough()
