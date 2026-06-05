// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const EngagementAdjustmentSchema = z.object({
  userId: z.string().min(1),
  units: z
    .number()
    .int()
    .refine((n) => n !== 0, { message: 'units must be non-zero' }),
  reason: z.string().trim().min(1).max(500),
  year: z.number().int().min(2020).max(2100).optional(),
})

export const EngagementAdjustmentResponseSchema = z.object({
  ok: z.literal(true),
  userId: z.string(),
  units: z.number().int(),
  year: z.number().int(),
})

export const AdminUserEngagementQuerySchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100).optional(),
})

export const AdminUserEngagementSchema = z.object({
  userId: z.string(),
  year: z.number().int(),
  totalUnits: z.number().int(),
  adjustments: z.array(
    z.object({
      units: z.number().int(),
      reason: z.string(),
      createdAt: z.coerce.date(),
      actorId: z.string(),
    }),
  ),
})
