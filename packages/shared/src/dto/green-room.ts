// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const GreenRoomInvitePoolSchema = z.enum(['MODERATORS_AND_SUBS', 'SUBS_ONLY', 'MANUAL_ONLY'])
export type GreenRoomInvitePool = z.infer<typeof GreenRoomInvitePoolSchema>

export const GreenRoomInviteSourceSchema = z.enum(['MODERATOR', 'FAN_SUB', 'MANUAL'])
export type GreenRoomInviteSource = z.infer<typeof GreenRoomInviteSourceSchema>

export const GreenRoomDefaultsSchema = z.object({
  defaultEnabled: z.boolean(),
  defaultInvitePool: GreenRoomInvitePoolSchema,
})
export type GreenRoomDefaults = z.infer<typeof GreenRoomDefaultsSchema>

export const PatchGreenRoomDefaultsSchema = z
  .object({
    defaultEnabled: z.boolean().optional(),
    defaultInvitePool: GreenRoomInvitePoolSchema.optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: 'Nothing to update' })
export type PatchGreenRoomDefaultsInput = z.infer<typeof PatchGreenRoomDefaultsSchema>

export const GreenRoomInviteViewSchema = z.object({
  userId: z.string(),
  username: z.string(),
  displayName: z.string(),
  source: GreenRoomInviteSourceSchema,
  invitedAt: z.string(),
  joinedAt: z.string().nullable(),
})
export type GreenRoomInviteView = z.infer<typeof GreenRoomInviteViewSchema>

export const GreenRoomCandidateViewSchema = z.object({
  userId: z.string(),
  username: z.string(),
  displayName: z.string(),
  kind: z.enum(['MODERATOR', 'FAN_SUB']),
})
export type GreenRoomCandidateView = z.infer<typeof GreenRoomCandidateViewSchema>

export const GreenRoomSessionViewSchema = z.object({
  enabled: z.boolean(),
  channelState: z.enum(['OFFLINE', 'PREVIEW', 'LIVE']),
  invitePool: GreenRoomInvitePoolSchema,
  invites: z.array(GreenRoomInviteViewSchema),
  candidates: z.array(GreenRoomCandidateViewSchema),
})
export type GreenRoomSessionView = z.infer<typeof GreenRoomSessionViewSchema>

export const PatchGreenRoomSessionSchema = z.object({
  enabled: z.boolean(),
})
export type PatchGreenRoomSessionInput = z.infer<typeof PatchGreenRoomSessionSchema>

export const AddGreenRoomInviteSchema = z.object({
  username: z.string().trim().min(1).max(64),
})
export type AddGreenRoomInviteInput = z.infer<typeof AddGreenRoomInviteSchema>

export const GreenRoomAccessViewSchema = z.object({
  hasAccess: z.boolean(),
  channelState: z.enum(['OFFLINE', 'PREVIEW', 'LIVE']),
  greenRoomEnabled: z.boolean(),
  joinedAt: z.string().nullable(),
  hlsUrl: z.string().nullable(),
  artistUsername: z.string(),
  artistDisplayName: z.string(),
})
export type GreenRoomAccessView = z.infer<typeof GreenRoomAccessViewSchema>
