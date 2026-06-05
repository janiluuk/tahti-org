// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const RevelatorReleaseStatusSchema = z.object({
  revelatorId: z.string().nullable(),
  revelatorStatus: z.string().nullable(),
  title: z.string(),
})

export const RevelatorSubmitAcceptedSchema = z.object({
  releaseId: z.string(),
  revelatorStatus: z.literal('pending'),
})

export const RevelatorBillingStatusSchema = z.object({
  paid: z.boolean(),
  feeCents: z.number().int(),
  waived: z.boolean(),
  studioIncludedRemaining: z.number().int().nullable(),
  distributionPaidAt: z.string().nullable(),
})

export const RevelatorCheckoutResponseSchema = z.union([
  z.object({
    checkoutUrl: z.string().url(),
    sessionId: z.string(),
  }),
  z.object({
    paid: z.literal(true),
    feeCents: z.number().int(),
    waived: z.boolean(),
  }),
])

export const RevelatorRoyaltyReportRowSchema = z.object({
  id: z.string(),
  releaseId: z.string(),
  releaseTitle: z.string(),
  periodStart: z.string(),
  periodEnd: z.string(),
  amountCents: z.number().int(),
  currency: z.string(),
  streams: z.number().int().nullable(),
  syncedAt: z.string(),
})

export const RevelatorRoyaltyReportsSchema = z.object({
  reports: z.array(RevelatorRoyaltyReportRowSchema),
})
