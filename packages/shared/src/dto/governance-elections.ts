// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'
import { GovernanceBoardRoleSchema, GovernanceBoardTermListSchema } from './governance.js'

export const GovernanceElectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  role: GovernanceBoardRoleSchema,
  seats: z.number().int(),
  meetingId: z.string().nullable(),
  nominationsCloseAt: z.coerce.date().nullable(),
  decidedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
})

export const GovernanceElectionListSchema = z.array(GovernanceElectionSchema)

/** POST /api/admin/governance/elections */
export const CreateGovernanceElectionSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    role: GovernanceBoardRoleSchema,
    seats: z.number().int().min(1).max(20),
    meetingId: z.string().cuid().optional(),
    nominationsCloseAt: z.coerce.date().optional(),
  })
  .refine((body) => body.role !== 'CHAIR' || body.seats === 1, {
    message: 'There is one chair',
    path: ['seats'],
  })

/** PATCH /api/admin/governance/elections/:id — until the result is recorded.
 * The role stays: a different role is a different election. */
export const UpdateGovernanceElectionSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    seats: z.number().int().min(1).max(20).optional(),
    meetingId: z.string().cuid().nullable().optional(),
    nominationsCloseAt: z.coerce.date().nullable().optional(),
  })
  .refine((body) => Object.values(body).some((value) => value !== undefined), {
    message: 'Nothing to change',
  })

export const GovernanceElectionCandidateSchema = z.object({
  id: z.string(),
  userId: z.string().nullable(),
  displayName: z.string(),
  statement: z.string().nullable(),
  // True when the member nominated themselves.
  selfNominated: z.boolean(),
  withdrawnAt: z.coerce.date().nullable(),
  elected: z.boolean(),
  createdAt: z.coerce.date(),
})

export const GovernanceElectionCandidateListSchema = z.array(GovernanceElectionCandidateSchema)

/** POST /api/admin/governance/elections/:id/candidates — the board nominates a member. */
export const NominateElectionCandidateSchema = z.object({
  userId: z.string().trim().min(1).max(64),
  statement: z.string().trim().min(1).max(2000).optional(),
})

/** POST /api/v1/governance/elections/:id/candidacy — a member stands. */
export const StandForElectionSchema = z.object({
  statement: z.string().trim().min(1).max(2000).optional(),
})

/** POST /api/admin/governance/elections/:id/result — who the meeting elected,
 * and the term they start. Each gets a board term in the election's role. */
export const RecordElectionResultSchema = z
  .object({
    electedUserIds: z
      .array(z.string().trim().min(1).max(64))
      .min(1)
      .max(20)
      .refine((ids) => new Set(ids).size === ids.length, 'A candidate is listed twice'),
    termStart: z.coerce.date(),
    termEnd: z.coerce.date().optional(),
  })
  .refine((body) => !body.termEnd || body.termEnd > body.termStart, {
    message: 'The term must end after it starts',
    path: ['termEnd'],
  })

export const GovernanceElectionResultSchema = z.object({
  election: GovernanceElectionSchema,
  candidates: GovernanceElectionCandidateListSchema,
  terms: GovernanceBoardTermListSchema,
})

/** GET /api/v1/governance/elections — elections with the candidates standing
 * (withdrawn candidacies left out), newest first. */
export const MemberGovernanceElectionListSchema = z.array(
  GovernanceElectionSchema.extend({
    nominationsOpen: z.boolean(),
    candidates: z.array(
      z.object({
        displayName: z.string(),
        username: z.string().nullable(),
        statement: z.string().nullable(),
        elected: z.boolean(),
      }),
    ),
    youAreCandidate: z.boolean(),
  }),
)
