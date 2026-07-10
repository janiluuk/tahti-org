// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const CreateArtistEventSchema = z.object({
  title: z.string().trim().min(1, 'title is required').max(160),
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

export const ArtistEventSchema = z.object({
  id: z.string(),
  title: z.string(),
  place: z.string(),
  location: z.string(),
  eventUrl: z.string().nullable(),
  startAt: z.string().datetime(),
})

export type ArtistEventView = z.infer<typeof ArtistEventSchema>

export const ArtistEventListSchema = z.array(ArtistEventSchema)
