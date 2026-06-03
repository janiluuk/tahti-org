// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

/** Categories allowed for manual board/treasurer ledger entries. */
export const ManualLedgerCategorySchema = z.enum([
  'REVENUE_SUBSCRIPTION',
  'REVENUE_DISTRIBUTION',
  'REVENUE_GRANT_INBOUND',
  'REVENUE_DONATION',
  'COST_INFRASTRUCTURE',
  'COST_DISTRIBUTION_PASSTHROUGH',
  'COST_OPERATIONS',
  'COST_SALARY',
  'COST_AUDIT',
  'COST_PROFESSIONAL_SERVICES',
  'GRANT_DISBURSEMENT',
  'RESERVE_TRANSFER',
])

export type ManualLedgerCategory = z.infer<typeof ManualLedgerCategorySchema>

export const CreateLedgerEntrySchema = z.object({
  category: ManualLedgerCategorySchema,
  amountCents: z.number().int().positive('amountCents must be a positive integer'),
  currency: z.string().length(3).optional(),
  description: z.string().trim().min(1, 'description is required').max(500),
  externalRef: z.string().trim().max(200).optional(),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
})

export type CreateLedgerEntryInput = z.infer<typeof CreateLedgerEntrySchema>

export const LedgerListQuerySchema = z.object({
  year: z
    .string()
    .regex(/^\d{4}$/)
    .optional(),
  month: z
    .string()
    .regex(/^(0?[1-9]|1[0-2])$/)
    .optional(),
})

export type LedgerListQuery = z.infer<typeof LedgerListQuerySchema>

export const LedgerExportQuerySchema = z.object({
  year: z
    .string()
    .regex(/^\d{4}$/)
    .optional(),
})

export type LedgerExportQuery = z.infer<typeof LedgerExportQuerySchema>
