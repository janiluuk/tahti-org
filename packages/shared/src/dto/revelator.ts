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
