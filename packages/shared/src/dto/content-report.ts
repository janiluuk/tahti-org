// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const ContentReportTargetTypeSchema = z.enum([
  'ARCHIVE_ITEM',
  'RELEASE',
  'CHANNEL',
  'COLLECTION',
  'MOTION_COMMENT',
])

export const ContentReportReasonSchema = z.enum([
  'COPYRIGHT',
  'HARASSMENT',
  'SPAM',
  'ILLEGAL_CONTENT',
  'OTHER',
])

export const ContentReportStatusSchema = z.enum(['OPEN', 'REVIEWING', 'ACTIONED', 'DISMISSED'])

export const SubmitContentReportSchema = z.object({
  targetType: ContentReportTargetTypeSchema,
  targetId: z.string().trim().min(1),
  reason: ContentReportReasonSchema,
  details: z.string().trim().max(2000).optional(),
})

export const SubmitContentReportResponseSchema = z.object({
  ok: z.literal(true),
  reportId: z.string(),
})

export const AdminContentReportListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  status: ContentReportStatusSchema.optional(),
})

export const AdminContentReportRowSchema = z.object({
  id: z.string(),
  targetType: ContentReportTargetTypeSchema,
  targetId: z.string(),
  reason: ContentReportReasonSchema,
  details: z.string().nullable(),
  status: ContentReportStatusSchema,
  resolvedById: z.string().nullable(),
  resolvedByDisplayName: z.string().nullable(),
  resolutionNote: z.string().nullable(),
  resolvedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
})

export const AdminContentReportListSchema = z.object({
  page: z.number().int(),
  limit: z.number().int(),
  total: z.number().int(),
  reports: z.array(AdminContentReportRowSchema),
})

export const AdminContentReportPatchSchema = z
  .object({
    status: ContentReportStatusSchema.optional(),
    resolutionNote: z.string().trim().max(2000).optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: 'No fields to update' })

export const ContentReportIdParamSchema = z.object({
  id: z.coerce.bigint().positive(),
})
