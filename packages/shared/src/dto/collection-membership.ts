// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

/** One collection the caller manages, and whether the sound is already in it.
 * `itemId` is the CollectionItem to DELETE when `member` is true. */
export const SetMembershipEntrySchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  coverUrl: z.string().nullable(),
  style: z.string(),
  isPublic: z.boolean(),
  visibility: z.enum(['PUBLIC', 'UNLISTED', 'DRAFT']),
  itemCount: z.number().int(),
  member: z.boolean(),
  itemId: z.string().nullable(),
})

export const SetMembershipResponseSchema = z.array(SetMembershipEntrySchema)

export type SetMembershipEntry = z.infer<typeof SetMembershipEntrySchema>
