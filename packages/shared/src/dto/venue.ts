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
  photos: z.array(z.string().max(2048)).max(10).optional(),
})

export type CreateVenueInput = z.infer<typeof CreateVenueSchema>

export const CreateVenueBroadcastSchema = z.object({
  startAt: z.string().datetime(),
  endAt: z.string().datetime().optional(),
  description: z.string().max(500).optional(),
  channelId: z.string().min(1).optional(),
})

export type CreateVenueBroadcastInput = z.infer<typeof CreateVenueBroadcastSchema>

export const PatchVenueSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    address: z.string().trim().min(1).max(200).optional(),
    city: z.string().trim().min(1).max(80).optional(),
    countryCode: z.string().length(2).optional(),
    description: z.string().max(2000).nullable().optional(),
    capacity: z.number().int().min(1).nullable().optional(),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    externalLinks: z.record(z.string().url()).optional(),
    photos: z.array(z.string().max(2048)).max(10).optional(),
  })
  .refine((b) => Object.keys(b).length > 0, { message: 'No fields to update' })

export type PatchVenueInput = z.infer<typeof PatchVenueSchema>

export const PatchVenueBroadcastSchema = z
  .object({
    startAt: z.string().datetime().optional(),
    endAt: z.string().datetime().nullable().optional(),
    description: z.string().max(500).nullable().optional(),
    channelId: z.string().min(1).nullable().optional(),
    state: z.enum(['SCHEDULED', 'CANCELED']).optional(),
  })
  .refine((b) => Object.keys(b).length > 0, { message: 'No fields to update' })

export type PatchVenueBroadcastInput = z.infer<typeof PatchVenueBroadcastSchema>
