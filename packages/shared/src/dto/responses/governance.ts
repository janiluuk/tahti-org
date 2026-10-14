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

/** Where a closed motion's published numbers come from: the result
 * certificate fixed at closing, the board's latest correction to it, or (for
 * motions closed before certificates existed) the vote rows as they are now. */
export const MotionTallySourceSchema = z.enum(['CERTIFICATE', 'CORRECTION', 'LIVE'])

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
  // Members who back this draft being put to a vote (never the proposer).
  secondCount: z.number().int(),
  youSeconded: z.boolean(),
  // When the board sent the draft round to members for seconds.
  circulatedAt: z.coerce.date().nullable(),
  // Only present once CLOSED (hidden while OPEN to avoid a bandwagon effect —
  // see comment in apps/api/src/routes/governance/index.ts). Included in the
  // list response, not just the detail one, since the governance page has no
  // per-motion detail fetch and this is the only place a closed motion's
  // result is shown.
  tally: MotionVoteTallySchema.optional(),
  tallySource: MotionTallySourceSchema.optional(),
})

export const MotionListSchema = z.array(MotionSummarySchema)

export const MotionMeetingRefSchema = z.object({
  id: z.string(),
  title: z.string(),
  scheduledAt: z.coerce.date().nullable(),
})

export const MotionAgendaItemRefSchema = z.object({
  id: z.string(),
  position: z.number().int(),
  title: z.string(),
})

export const MotionDetailSchema = MotionSummarySchema.extend({
  description: z.string(),
  // The meeting that takes this motion up, if the board linked one. A
  // meeting still in DRAFT is shown to the board only.
  meeting: MotionMeetingRefSchema.nullable(),
  // The item on that meeting's agenda, if the board named one.
  agendaItem: MotionAgendaItemRefSchema.nullable(),
})

export const MotionCommentSchema = z.object({
  id: z.string(),
  body: z.string(),
  authorId: z.string().nullable(),
  authorDisplayName: z.string().nullable(),
  createdAt: z.coerce.date(),
  // A removed comment keeps its place in the thread with an empty body.
  removed: z.boolean(),
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

export const MotionSecondResponseSchema = z.object({
  ok: z.literal(true),
  secondCount: z.number().int(),
})

/** POST /api/v1/governance/motions/:id/circulate — how many members were told. */
export const MotionCirculateResponseSchema = z.object({
  id: z.string(),
  circulatedAt: z.coerce.date(),
  notified: z.number().int(),
})

/** Who seconded a motion, oldest first. Members only, like the motion itself. */
export const MotionSeconderSchema = z.object({
  displayName: z.string(),
  username: z.string(),
  secondedAt: z.coerce.date(),
})

export const MotionSeconderListSchema = z.array(MotionSeconderSchema)

export const MotionWithdrawnResponseSchema = z.object({
  ok: z.literal(true),
})

export const MotionDraftEditedResponseSchema = z.object({
  id: z.string(),
  state: z.string(),
  // Seconds removed because the text they backed has changed.
  secondsCleared: z.number().int(),
})

export const MotionCommentRemovedResponseSchema = z.object({
  ok: z.literal(true),
})

export const MotionMeetingLinkResponseSchema = z.object({
  id: z.string(),
  meeting: MotionMeetingRefSchema.nullable(),
  agendaItem: MotionAgendaItemRefSchema.nullable(),
})

/** The fixed result of a closed motion (GET .../motions/:id/certificate). */
export const MotionCertificateSchema = z.object({
  motionId: z.string(),
  title: z.string(),
  advisory: z.boolean(),
  closedAt: z.coerce.date(),
  eligibleMemberCount: z.number().int().nullable(),
  tally: MotionVoteTallySchema,
  totalVotes: z.number().int(),
  algorithm: z.literal('sha256'),
  digest: z.string(),
  // False when the motion's text or the stored tally no longer produce the
  // digest, or the vote rows no longer add up to the stored tally.
  matchesRecord: z.boolean(),
  // Corrections the board has added since, oldest first. The certificate
  // above is never rewritten; `correctedTally` is the latest corrected count.
  corrections: z.array(
    z.object({
      id: z.string(),
      note: z.string(),
      tally: MotionVoteTallySchema.nullable(),
      createdAt: z.coerce.date(),
      digest: z.string(),
      // False when this entry no longer chains to the one before it.
      matchesRecord: z.boolean(),
    }),
  ),
  correctedTally: MotionVoteTallySchema.nullable(),
})

/** POST /api/admin/governance/motions/:id/result-corrections */
export const CreateMotionResultCorrectionSchema = z.object({
  note: z.string().trim().min(1).max(2000),
  tally: MotionVoteTallySchema.extend({
    YES: z.number().int().min(0),
    NO: z.number().int().min(0),
    ABSTAIN: z.number().int().min(0),
  }).optional(),
})
