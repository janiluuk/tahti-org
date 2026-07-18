// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const FeatureRequestStatusSchema = z.enum([
  'OPEN',
  'PLANNED',
  'IN_PROGRESS',
  'DONE',
  'DECLINED',
  'DUPLICATE',
])
export type FeatureRequestStatus = z.infer<typeof FeatureRequestStatusSchema>

export const CreateFeatureRequestSchema = z.object({
  title: z.string().trim().min(1).max(150),
  description: z.string().trim().min(1).max(3000),
})
export type CreateFeatureRequestInput = z.infer<typeof CreateFeatureRequestSchema>

export const FeatureRequestSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  status: FeatureRequestStatusSchema,
  proposer: z.string(),
  voteCount: z.number().int(),
  youVoted: z.boolean(),
  commentCount: z.number().int(),
  reviewNote: z.string().nullable(),
  reviewedAt: z.coerce.date().nullable(),
  mergedIntoId: z.string().nullable(),
  mergedIntoTitle: z.string().nullable(),
  createdAt: z.coerce.date(),
})
export type FeatureRequestSummary = z.infer<typeof FeatureRequestSummarySchema>
export const FeatureRequestListSchema = z.array(FeatureRequestSummarySchema)

export const FeatureRequestCommentSchema = z.object({
  id: z.string(),
  body: z.string(),
  authorId: z.string().nullable(),
  authorDisplayName: z.string().nullable(),
  createdAt: z.coerce.date(),
})
export type FeatureRequestComment = z.infer<typeof FeatureRequestCommentSchema>
export const FeatureRequestCommentListSchema = z.array(FeatureRequestCommentSchema)

export const PostFeatureRequestCommentSchema = z.object({
  body: z.string().trim().min(1).max(2000),
})

export const VoteFeatureRequestResponseSchema = z.object({
  ok: z.literal(true),
  voteCount: z.number().int(),
})

// ── Admin ────────────────────────────────────────────────────────────────────

export const AdminFeatureRequestRowSchema = FeatureRequestSummarySchema.extend({
  proposerUsername: z.string(),
})
export const AdminFeatureRequestListSchema = z.array(AdminFeatureRequestRowSchema)

export const PatchFeatureRequestSchema = z
  .object({
    status: FeatureRequestStatusSchema.optional(),
    reviewNote: z.string().trim().max(2000).optional(),
    mergedIntoId: z.string().nullable().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: 'No fields to update' })
export type PatchFeatureRequestInput = z.infer<typeof PatchFeatureRequestSchema>

export const FeatureRequestQuarterlyReportSchema = z.object({
  id: z.string(),
  year: z.number().int(),
  quarter: z.number().int(),
  storageKey: z.string(),
  generatedAt: z.coerce.date(),
  generatedByDisplayName: z.string(),
  downloadUrl: z.string().nullable(),
})
export const FeatureRequestQuarterlyReportListSchema = z.array(FeatureRequestQuarterlyReportSchema)

export const FeatureRequestQuarterlyReportGeneratedSchema = z.object({
  ok: z.literal(true),
  year: z.number().int(),
  quarter: z.number().int(),
  id: z.string(),
  markdown: z.string(),
  downloadUrl: z.string(),
})

export const GenerateFeatureRequestQuarterlyReportSchema = z.object({
  year: z.number().int().min(2020).max(2100).optional(),
  quarter: z.number().int().min(1).max(4).optional(),
})
