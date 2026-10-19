// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const CreateArtistEventSchema = z.object({
  title: z.string().trim().min(1, 'title is required').max(160),
  description: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((s) => s || null),
  place: z.string().trim().min(1, 'place is required').max(160),
  location: z.string().trim().min(1, 'location is required').max(160),
  eventUrl: z
    .string()
    .trim()
    .max(500)
    .optional()
    .refine((v) => !v || /^https?:\/\//i.test(v), { message: 'eventUrl must be an http(s) URL' }),
  startAt: z.string().datetime(),
})

export type CreateArtistEventInput = z.infer<typeof CreateArtistEventSchema>

export const UpdateArtistEventSchema = CreateArtistEventSchema.partial().refine(
  (body) => Object.values(body).some((v) => v !== undefined),
  { message: 'Nothing to update' },
)

export type UpdateArtistEventInput = z.infer<typeof UpdateArtistEventSchema>

export const ArtistEventSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  place: z.string(),
  location: z.string(),
  eventUrl: z.string().nullable(),
  startAt: z.string().datetime(),
})

export type ArtistEventView = z.infer<typeof ArtistEventSchema>

export const ArtistEventListSchema = z.array(ArtistEventSchema)

export const UpcomingEventsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(12),
})

export const UpcomingEventSchema = ArtistEventSchema.extend({
  artistDisplayName: z.string(),
  artistUsername: z.string(),
  channelSlug: z.string().nullable(),
  avatarUrl: z.string().nullable(),
})

export type UpcomingEventView = z.infer<typeof UpcomingEventSchema>

export const UpcomingEventListSchema = z.array(UpcomingEventSchema)
