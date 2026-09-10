// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const GrantAnomalySchema = z.object({
  code: z.enum(['DOMINANT_IP', 'HIGH_UNIT_SHARE', 'ANONYMOUS_GRANT']),
  message: z.string(),
})

export const GrantPreviewArtistSchema = z.object({
  userId: z.string(),
  username: z.string(),
  displayName: z.string(),
  publicAttribution: z.boolean(),
  units: z.number(),
  amountCents: z.number().int(),
  freeDownloads: z.number().int(),
  paidDownloads: z.number().int(),
  fanSubEuros: z.number().int(),
  anomalies: z.array(GrantAnomalySchema),
})

export const GrantPreviewResponseSchema = z.object({
  forYear: z.number().int(),
  alreadyRun: z.boolean(),
  surplusCents: z.number().int(),
  reserveCents: z.number().int(),
  poolCents: z.number().int(),
  totalUnits: z.number(),
  grantCount: z.number().int(),
  unallocatedCents: z.number().int(),
  artists: z.array(GrantPreviewArtistSchema),
})

/** POST /api/admin/grants/run/:year — same summary fields as preview, without artist rows. */
export const GrantRunResponseSchema = GrantPreviewResponseSchema.omit({ artists: true })

export const MeGrantDisbursementSchema = z.object({
  forYear: z.number().int(),
  units: z.number(),
  amountCents: z.string(),
  state: z.string(),
  notifiedAt: z.coerce.date().nullable(),
  confirmedAt: z.coerce.date().nullable(),
  paidAt: z.coerce.date().nullable(),
})

export const MeGrantListSchema = z.array(MeGrantDisbursementSchema)

/** Forecast of this artist's share of the current year's grant pool, based
 *  on engagement units accrued so far and the year-to-date surplus. */
export const MeGrantEstimateSchema = z.object({
  year: z.number().int(),
  estimateCents: z.number().int().nonnegative(),
  units: z.number().nonnegative(),
  eligible: z.boolean(),
  freeDownloads: z.number().int().nonnegative(),
  paidDownloads: z.number().int().nonnegative(),
  fanSubEuros: z.number().int().nonnegative(),
})
