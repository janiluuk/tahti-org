// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const GovernanceAgendaItemSchema = z.object({
  id: z.string(),
  meetingId: z.string(),
  position: z.number().int(),
  title: z.string(),
  description: z.string().nullable(),
})

export const GovernanceAgendaItemListSchema = z.array(GovernanceAgendaItemSchema)

/** POST /api/admin/governance/meetings/:id/agenda-items — added at the end. */
export const CreateGovernanceAgendaItemSchema = z.object({
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().min(1).max(5000).optional(),
})

/** PATCH /api/admin/governance/agenda-items/:id — null clears the description. */
export const PatchGovernanceAgendaItemSchema = z
  .object({
    title: z.string().trim().min(1).max(300),
    description: z.string().trim().min(1).max(5000).nullable(),
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'Nothing to change')

/** PUT /api/admin/governance/meetings/:id/agenda-items/order — every item of
 * the meeting, each once, in the new order. */
export const ReorderGovernanceAgendaItemsSchema = z.object({
  ids: z
    .array(z.string().min(1).max(64))
    .min(1)
    .max(200)
    .refine((ids) => new Set(ids).size === ids.length, 'An item is listed twice'),
})

/** GET /api/v1/governance/meetings/:id/agenda-items — each item with the
 * records filed under it that members can see: motions past DRAFT, published
 * resolutions, and published documents that are not archived. */
export const MemberGovernanceAgendaItemListSchema = z.array(
  GovernanceAgendaItemSchema.extend({
    motions: z.array(
      z.object({ id: z.string(), title: z.string(), state: z.enum(['OPEN', 'CLOSED']) }),
    ),
    resolutions: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        outcome: z.enum(['PASSED', 'FAILED', 'DEFERRED']),
      }),
    ),
    documents: z.array(z.object({ id: z.string(), title: z.string(), type: z.string() })),
  }),
)
