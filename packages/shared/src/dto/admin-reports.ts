// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const AdminAnnualReportRowSchema = z.object({
  id: z.string(),
  year: z.number().int(),
  storageKey: z.string(),
  generatedAt: z.coerce.date(),
  generatedByDisplayName: z.string().nullable(),
  downloadUrl: z.string().nullable(),
})

export const AdminAnnualReportListSchema = z.array(AdminAnnualReportRowSchema)

export const AdminAnnualReportGeneratedSchema = z.object({
  ok: z.literal(true),
  year: z.number().int(),
  id: z.string(),
  markdown: z.string(),
  downloadUrl: z.string(),
})

export const TransparencyResolutionItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  votedAt: z.coerce.date(),
  outcome: z.string(),
  voteFor: z.number().int(),
  voteAgainst: z.number().int(),
  voteAbstain: z.number().int(),
})

export const TransparencyResolutionListSchema = z.array(TransparencyResolutionItemSchema)
