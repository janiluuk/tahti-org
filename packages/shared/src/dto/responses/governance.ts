// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const GovernanceMemberViewSchema = z.object({
  memberNumber: z.number().int().nullable(),
  displayName: z.string(),
  username: z.string(),
  memberSince: z.coerce.date().nullable(),
  isBoard: z.boolean(),
  channelSlug: z.string().nullable(),
})

export const GovernanceMemberListSchema = z.array(GovernanceMemberViewSchema)

/** Board-only PRH register preview (includes email; use export.csv for official file). */
export const AdminMemberRegisterRowSchema = z.object({
  memberNumber: z.number().int().nullable(),
  displayName: z.string(),
  email: z.string().email(),
  username: z.string(),
  memberSince: z.coerce.date().nullable(),
  membershipStatus: z.string().nullable(),
})

export const AdminMemberRegisterListSchema = z.array(AdminMemberRegisterRowSchema)

export const MotionVoteTallySchema = z.object({
  YES: z.number().int(),
  NO: z.number().int(),
  ABSTAIN: z.number().int(),
})

export const MotionSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  state: z.string(),
  advisory: z.boolean(),
  openAt: z.coerce.date(),
  closeAt: z.coerce.date(),
  proposer: z.string(),
  totalVotes: z.number().int(),
  youVoted: z.boolean(),
  yourChoice: z.string().nullable(),
  commentCount: z.number().int(),
  // Eligible-voter count frozen when voting opened (null for motions opened
  // before this field existed, and for motions still in DRAFT).
  eligibleMemberCount: z.number().int().nullable(),
  // Only present once CLOSED (hidden while OPEN to avoid a bandwagon effect —
  // see comment in apps/api/src/routes/governance/index.ts). Included in the
  // list response, not just the detail one, since the governance page has no
  // per-motion detail fetch and this is the only place a closed motion's
  // result is shown.
  tally: MotionVoteTallySchema.optional(),
})

export const MotionListSchema = z.array(MotionSummarySchema)

export const MotionDetailSchema = MotionSummarySchema.extend({
  description: z.string(),
})

export const MotionCommentSchema = z.object({
  id: z.string(),
  body: z.string(),
  authorId: z.string().nullable(),
  authorDisplayName: z.string().nullable(),
  createdAt: z.coerce.date(),
})

export const MotionCommentListSchema = z.array(MotionCommentSchema)

// Bulk discussion-thread lookup for a list of motions in one request (used by
// governance list pages to avoid an N+1 fetch — one request per motion) —
// keyed by motion id, values in the same shape as MotionCommentListSchema.
export const MotionCommentsBulkSchema = z.record(z.string(), MotionCommentListSchema)

export const MotionRefResponseSchema = z.object({
  id: z.string(),
  state: z.string(),
})

export const VoteCastResponseSchema = z.object({
  ok: z.literal(true),
  choice: z.string(),
})

export const VoteRetractResponseSchema = z.object({
  ok: z.literal(true),
})
