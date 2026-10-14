// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'
import { GovernanceBoardRoleSchema } from './governance.js'

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

export const GovernanceElectionCandidateSchema = z.object({
  id: z.string(),
  userId: z.string().nullable(),
  displayName: z.string(),
  statement: z.string().nullable(),
  // True when the member nominated themselves.
  selfNominated: z.boolean(),
  withdrawnAt: z.coerce.date().nullable(),
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
