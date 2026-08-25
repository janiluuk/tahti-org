// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

// ── Missed live show queue (MissedLiveShowFlag) ────────────────────────────

export const MissedLiveShowFlagStatusSchema = z.enum(['OPEN', 'REVIEWING', 'ACTIONED', 'DISMISSED'])

export const MissedLiveShowFlagIdParamSchema = z.object({
  id: z.coerce.bigint().positive(),
})

export const MissedLiveShowFlagListQuerySchema = z.object({
  status: MissedLiveShowFlagStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
})

export const MissedLiveShowFlagViewSchema = z.object({
  id: z.string(),
  status: MissedLiveShowFlagStatusSchema,
  detectedAt: z.string().datetime(),
  resolutionNote: z.string().nullable(),
  resolvedAt: z.string().datetime().nullable(),
  scheduledLiveShow: z.object({
    id: z.string(),
    title: z.string(),
    startAt: z.string().datetime(),
  }),
  channel: z.object({
    slug: z.string(),
    userId: z.string(),
    username: z.string(),
    displayName: z.string(),
  }),
})

export const MissedLiveShowFlagListSchema = z.object({
  flags: z.array(MissedLiveShowFlagViewSchema),
})

export const MissedLiveShowFlagPatchSchema = z.object({
  status: MissedLiveShowFlagStatusSchema,
  resolutionNote: z.string().trim().max(2_000).nullable().optional(),
})

export type MissedLiveShowFlagView = z.infer<typeof MissedLiveShowFlagViewSchema>

// ── Account restrictions (booking / upload / login) ─────────────────────────

export const AccountRestrictionTypeSchema = z.enum(['LIVE_SHOW_BOOKING', 'UPLOAD', 'LOGIN'])

export const AccountRestrictionViewSchema = z.object({
  id: z.string(),
  type: AccountRestrictionTypeSchema,
  reason: z.string(),
  bannedAt: z.string().datetime(),
  expiresAt: z.string().datetime().nullable(),
  liftedAt: z.string().datetime().nullable(),
  bannedByUsername: z.string().nullable(),
})

export const AccountRestrictionListSchema = z.object({
  restrictions: z.array(AccountRestrictionViewSchema),
})

export const CreateAccountRestrictionSchema = z.object({
  type: AccountRestrictionTypeSchema,
  reason: z.string().trim().min(1, 'Reason is required').max(500),
  /// Null/omitted = indefinite.
  durationDays: z.number().int().min(1).max(3_650).nullable().optional(),
})

export type AccountRestrictionView = z.infer<typeof AccountRestrictionViewSchema>
export type CreateAccountRestriction = z.infer<typeof CreateAccountRestrictionSchema>
