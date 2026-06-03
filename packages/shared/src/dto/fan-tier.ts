// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

const amountCents = z
  .number()
  .int()
  .min(100, 'amountCents must be at least 100 (€1)')
  .max(10_000, 'amountCents must be at most 10000 (€100)')

export const FanTierBodySchema = z.object({
  name: z.string().trim().min(1, 'name is required').max(60),
  amountCents,
  description: z
    .string()
    .trim()
    .max(280)
    .optional()
    .transform((s) => (s === '' ? null : (s ?? null))),
  perks: z
    .array(z.string())
    .max(5)
    .optional()
    .transform((arr) =>
      (arr ?? [])
        .map((p) => p.trim())
        .filter(Boolean)
        .slice(0, 5),
    ),
})

export type FanTierBodyInput = z.infer<typeof FanTierBodySchema>

export const FanTierPatchSchema = FanTierBodySchema.partial().extend({
  active: z.boolean().optional(),
  position: z.number().int().min(0).optional(),
})

export type FanTierPatchInput = z.infer<typeof FanTierPatchSchema>

export const FanSubCheckoutSchema = z.object({
  tierId: z.string().min(1, 'tierId is required'),
})

export type FanSubCheckoutInput = z.infer<typeof FanSubCheckoutSchema>
