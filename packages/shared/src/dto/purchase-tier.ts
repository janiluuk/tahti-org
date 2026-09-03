// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

// One-time-purchase tiers — distinct from FanTier (recurring). An artist
// prices a tier once and assigns it to specific tracks; a fan buys access
// without subscribing. See PurchaseTier/Purchase in packages/db/prisma/schema.prisma.

const priceCents = z
  .number()
  .int()
  .min(0, 'priceCents must be at least 0')
  .max(50_000, 'priceCents must be at most 50000 (€500)')

export const PurchaseTierBodySchema = z.object({
  name: z.string().trim().min(1, 'name is required').max(60),
  priceCents,
  priceOptional: z.boolean().optional().default(false),
  description: z
    .string()
    .trim()
    .max(280)
    .optional()
    .transform((s) => (s === '' ? null : (s ?? null))),
})

export type PurchaseTierBodyInput = z.infer<typeof PurchaseTierBodySchema>

export const PurchaseTierPatchSchema = PurchaseTierBodySchema.partial().extend({
  active: z.boolean().optional(),
  position: z.number().int().min(0).optional(),
})

export type PurchaseTierPatchInput = z.infer<typeof PurchaseTierPatchSchema>

// amountCents is required only when the tier is priceOptional (buyer names
// their own amount, including 0); the route falls back to tier.priceCents otherwise.
export const PurchaseCheckoutSchema = z.object({
  amountCents: z.number().int().min(0).optional(),
})

export type PurchaseCheckoutInput = z.infer<typeof PurchaseCheckoutSchema>

export const StoreSettingsPatchSchema = z.object({
  storeEnabled: z.boolean(),
})

export type StoreSettingsPatch = z.infer<typeof StoreSettingsPatchSchema>

export const ArchiveItemAccessPatchSchema = z.object({
  accessMode: z.enum(['FREE', 'SUBSCRIBERS_ONLY', 'PURCHASE']),
  // Required iff accessMode is PURCHASE; ignored otherwise.
  purchaseTierId: z.string().nullable().optional(),
})

export type ArchiveItemAccessPatch = z.infer<typeof ArchiveItemAccessPatchSchema>
