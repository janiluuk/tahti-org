// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const TransparencyYtdResponseSchema = z.object({
  year: z.string(),
  byCategory: z.record(z.string()),
  runningSurplus: z.string(),
  monthsFinalized: z.number().int().nonnegative(),
})

export const TransparencyLedgerEntrySchema = z.object({
  id: z.string(),
  description: z.string(),
  category: z.string(),
  amountCents: z.string(),
  createdAt: z.string(),
})

export const TransparencyLedgerLatestSchema = z.array(TransparencyLedgerEntrySchema)

export const TransparencyGrantReportSchema = z.object({
  year: z.number().int(),
  totalCents: z.string(),
  grantCount: z.number().int().nonnegative(),
  disbursedAt: z.string().datetime().nullable(),
  grants: z.array(
    z.object({
      publishedAs: z.string(),
      units: z.number(),
      amountCents: z.string(),
      state: z.string(),
    }),
  ),
})

export const TransparencyMonthlyRollupSchema = z.object({
  yearMonth: z.string(),
  byCategory: z.record(z.unknown()),
  surplus: z.string(),
  finalizedAt: z.string().datetime().nullable(),
})

export const TransparencyMonthlyRollupListSchema = z.array(TransparencyMonthlyRollupSchema)

export const TransparencyCategoriesResponseSchema = z.object({
  revenue: z.array(z.object({ code: z.string(), label: z.string() })),
  costs: z.array(z.object({ code: z.string(), label: z.string() })),
  disbursements: z.array(z.object({ code: z.string(), label: z.string() })),
})
