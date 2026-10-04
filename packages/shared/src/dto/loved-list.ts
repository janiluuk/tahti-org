// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'
import { TopListEntrySchema } from './top-lists.js'

export const LovedListEntrySchema = TopListEntrySchema.omit({ listens: true }).extend({
  loves: z.number().int(),
})

export const LovedListResponseSchema = z.object({
  entries: z.array(LovedListEntrySchema),
})

export type LovedListEntry = z.infer<typeof LovedListEntrySchema>
