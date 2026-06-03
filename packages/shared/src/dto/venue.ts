// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const CreateVenueSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .transform((s) => s.toLowerCase().replace(/[^a-z0-9-]/g, '-')),
  name: z.string().trim().min(1).max(120),
  address: z.string().trim().min(1).max(200),
  city: z.string().trim().min(1).max(80),
  countryCode: z.string().length(2).optional(),
  description: z.string().max(2000).optional(),
  capacity: z.number().int().min(1).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  externalLinks: z.record(z.string().url()).optional(),
})

export type CreateVenueInput = z.infer<typeof CreateVenueSchema>

export const CreateVenueBroadcastSchema = z.object({
  startAt: z.string().datetime(),
  endAt: z.string().datetime().optional(),
  description: z.string().max(500).optional(),
  channelId: z.string().min(1).optional(),
})

export type CreateVenueBroadcastInput = z.infer<typeof CreateVenueBroadcastSchema>
