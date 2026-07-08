// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const ResolutionOutcomeSchema = z.enum(['PASSED', 'FAILED', 'DEFERRED'])

export const AdminResolutionListQuerySchema = z.object({
  publishedOnly: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
})

export const AdminResolutionRowSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  votedAt: z.coerce.date(),
  outcome: z.string(),
  voteFor: z.number().int(),
  voteAgainst: z.number().int(),
  voteAbstain: z.number().int(),
  publishedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  createdByDisplayName: z.string().nullable(),
})

export const AdminResolutionListSchema = z.array(AdminResolutionRowSchema)

// Cross-validation between `outcome` and the vote counts — without this, a board
// admin could type PASSED with voteFor: 0, voteAgainst: 100 and it would publish
// as-is (found during the governance E2E audit, 2026-07-08). DEFERRED is exempt:
// it means no up/down decision was reached, regardless of the raw counts.
export function outcomeMatchesVotes(data: {
  outcome: string
  voteFor: number
  voteAgainst: number
}) {
  if (data.outcome === 'DEFERRED') return true
  return data.outcome === 'PASSED'
    ? data.voteFor > data.voteAgainst
    : data.voteFor <= data.voteAgainst
}

export const AdminResolutionCreateSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    body: z.string().trim().min(1).max(20000),
    votedAt: z.coerce.date(),
    outcome: ResolutionOutcomeSchema,
    voteFor: z.number().int().min(0),
    voteAgainst: z.number().int().min(0),
    voteAbstain: z.number().int().min(0),
  })
  .refine(outcomeMatchesVotes, {
    message: 'outcome does not match the vote counts (PASSED needs voteFor > voteAgainst)',
    path: ['outcome'],
  })

export const AdminResolutionPatchSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    body: z.string().trim().min(1).max(20000).optional(),
    publishedAt: z.coerce.date().nullable().optional(),
    outcome: ResolutionOutcomeSchema.optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: 'No fields to update' })

export const ResolutionIdParamSchema = z.object({
  id: z.coerce.bigint().positive(),
})
