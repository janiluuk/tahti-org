// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const MotionChoiceSchema = z.enum(['YES', 'NO', 'ABSTAIN'])
export type MotionChoice = z.infer<typeof MotionChoiceSchema>

export const CreateMotionSchema = z
  .object({
    title: z.string().trim().min(1, 'title is required').max(200),
    description: z.string().trim().min(1, 'description is required').max(10_000),
    openAt: z.coerce.date(),
    closeAt: z.coerce.date(),
    advisory: z.boolean().optional(),
  })
  .refine((d) => d.closeAt > d.openAt, {
    message: 'closeAt must be after openAt',
    path: ['closeAt'],
  })

export type CreateMotionInput = z.infer<typeof CreateMotionSchema>

export const PatchMotionSchema = z.object({
  state: z.enum(['OPEN', 'CLOSED']).optional(),
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().min(1).max(10_000).optional(),
})

export type PatchMotionInput = z.infer<typeof PatchMotionSchema>

export const VoteMotionSchema = z.object({
  choice: z.preprocess((v) => (typeof v === 'string' ? v.toUpperCase() : v), MotionChoiceSchema),
})

export type VoteMotionInput = z.infer<typeof VoteMotionSchema>

export const PostMotionCommentSchema = z.object({
  body: z.string().trim().min(1, 'comment is required').max(2000),
})

export type PostMotionCommentInput = z.infer<typeof PostMotionCommentSchema>

export const TransparencyMotionItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  closedAt: z.coerce.date(),
  proposer: z.string(),
  voteFor: z.number().int(),
  voteAgainst: z.number().int(),
  voteAbstain: z.number().int(),
})

export const TransparencyMotionListSchema = z.array(TransparencyMotionItemSchema)

export const GovernanceMeetingTypeSchema = z.enum(['GENERAL', 'EXTRAORDINARY_GENERAL', 'BOARD'])
export const GovernanceMeetingStateSchema = z.enum([
  'DRAFT',
  'SCHEDULED',
  'HELD',
  'MINUTES_DRAFT',
  'APPROVED',
  'CANCELLED',
])
export const GovernanceDocumentTypeSchema = z.enum([
  'BYLAWS',
  'POLICY',
  'MEETING_NOTICE',
  'MINUTES',
  'ANNUAL_REPORT',
  'FINANCIAL_STATEMENT',
  'AUDIT_REPORT',
  'OTHER',
])

export const CreateGovernanceMeetingSchema = z.object({
  title: z.string().trim().min(1).max(200),
  type: GovernanceMeetingTypeSchema,
  scheduledAt: z.coerce.date().optional(),
  location: z.string().trim().max(300).optional(),
  remoteUrl: z.string().url().max(1000).optional(),
  noticeAt: z.coerce.date().optional(),
  eligibleMemberCount: z.number().int().nonnegative().optional(),
  quorumRequired: z.number().int().positive().optional(),
  chairName: z.string().trim().max(200).optional(),
  secretaryName: z.string().trim().max(200).optional(),
  agenda: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(300),
        description: z.string().max(5000).optional(),
      }),
    )
    .max(100)
    .optional(),
})

export const PatchGovernanceMeetingSchema = z.object({
  state: GovernanceMeetingStateSchema.optional(),
  scheduledAt: z.coerce.date().nullable().optional(),
  location: z.string().trim().max(300).nullable().optional(),
  remoteUrl: z.string().url().max(1000).nullable().optional(),
  noticeAt: z.coerce.date().nullable().optional(),
  eligibleMemberCount: z.number().int().nonnegative().nullable().optional(),
  quorumRequired: z.number().int().positive().nullable().optional(),
  agenda: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(300),
        description: z.string().max(5000).optional(),
      }),
    )
    .max(100)
    .nullable()
    .optional(),
  minutesKey: z.string().trim().max(500).nullable().optional(),
  minutesApprovedAt: z.coerce.date().nullable().optional(),
  chairName: z.string().trim().max(200).nullable().optional(),
  secretaryName: z.string().trim().max(200).nullable().optional(),
  minutesSignedAt: z.coerce.date().nullable().optional(),
  minutesSignedByName: z.string().trim().max(200).nullable().optional(),
})

export const CreateGovernanceDocumentSchema = z.object({
  title: z.string().trim().min(1).max(200),
  type: GovernanceDocumentTypeSchema,
  description: z.string().trim().max(5000).optional(),
  storageKey: z.string().trim().max(500).optional(),
  externalUrl: z.string().url().max(1000).optional(),
  version: z.number().int().positive().max(1000).optional(),
  effectiveAt: z.coerce.date().optional(),
  publishedAt: z.coerce.date().nullable().optional(),
  meetingId: z.string().cuid().nullable().optional(),
})

export const GovernanceMeetingItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: GovernanceMeetingTypeSchema,
  state: GovernanceMeetingStateSchema,
  scheduledAt: z.coerce.date().nullable(),
  location: z.string().nullable(),
  remoteUrl: z.string().nullable(),
  noticeAt: z.coerce.date().nullable(),
  agenda: z.unknown().nullable(),
  minutesKey: z.string().nullable(),
  minutesApprovedAt: z.coerce.date().nullable(),
  chairName: z.string().nullable(),
  secretaryName: z.string().nullable(),
  minutesSignedAt: z.coerce.date().nullable(),
  minutesSignedByName: z.string().nullable(),
  eligibleMemberCount: z.number().int().nullable(),
  quorumRequired: z.number().int().nullable(),
  attendanceCount: z.number().int(),
  presentCount: z.number().int(),
  quorumMet: z.boolean().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export const GovernanceMeetingListSchema = z.array(GovernanceMeetingItemSchema)

export const GovernanceAttendanceStatusSchema = z.enum(['PRESENT', 'ABSENT', 'EXCUSED'])
export const UpsertGovernanceAttendanceSchema = z.object({
  memberId: z.string().cuid().nullable().optional(),
  displayName: z.string().trim().min(1).max(200),
  status: GovernanceAttendanceStatusSchema,
})
export const GovernanceAttendanceItemSchema = z.object({
  id: z.string(),
  memberId: z.string().nullable(),
  displayName: z.string(),
  status: GovernanceAttendanceStatusSchema,
  recordedAt: z.coerce.date(),
})
export const GovernanceAttendanceListSchema = z.array(GovernanceAttendanceItemSchema)

export const GovernanceDocumentItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: GovernanceDocumentTypeSchema,
  description: z.string().nullable(),
  version: z.number().int(),
  effectiveAt: z.coerce.date().nullable(),
  publishedAt: z.coerce.date().nullable(),
  meetingId: z.string().nullable(),
  downloadUrl: z.string().nullable(),
  externalUrl: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export const GovernanceDocumentListSchema = z.array(GovernanceDocumentItemSchema)
