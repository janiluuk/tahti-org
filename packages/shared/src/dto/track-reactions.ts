// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const TrackReactionTypeSchema = z.enum(['LOVE', 'LAUGH', 'SURPRISE', 'HANDS_UP'])
export type TrackReactionTypeInput = z.infer<typeof TrackReactionTypeSchema>

export const TrackReactionCreateSchema = z.object({
  type: TrackReactionTypeSchema,
  /** Seconds into the track's timeline this reaction was left at. */
  positionSec: z
    .number()
    .min(0)
    .max(24 * 60 * 60),
})
export type TrackReactionCreateInput = z.infer<typeof TrackReactionCreateSchema>
