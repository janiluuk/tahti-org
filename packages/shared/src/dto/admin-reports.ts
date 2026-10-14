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
  approvedAt: z.coerce.date().nullable(),
  approvalMeetingId: z.string().nullable(),
  publishedAt: z.coerce.date().nullable(),
  filedAt: z.coerce.date().nullable(),
  filingReference: z.string().nullable(),
})

/** PUT /api/admin/reports/annual/:year/filing — null `filedAt` clears it. */
export const AnnualReportFilingSchema = z.object({
  filedAt: z.coerce.date().nullable(),
  filingReference: z.string().trim().min(1).max(100).nullable().optional(),
})

/** GET /api/v1/governance/annual-reports — published reports, newest first. */
export const PublishedAnnualReportListSchema = z.array(
  z.object({
    year: z.number().int(),
    approvedAt: z.coerce.date(),
    publishedAt: z.coerce.date(),
    filedAt: z.coerce.date().nullable(),
    downloadUrl: z.string().nullable(),
  }),
)

/** POST /api/admin/reports/annual/:year/approve */
export const ApproveAnnualReportSchema = z.object({
  meetingId: z.string().cuid().optional(),
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
