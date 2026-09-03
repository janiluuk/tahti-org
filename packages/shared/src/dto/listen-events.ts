// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const RecordListenSchema = z.object({
  soundId: z.string().min(1).max(64),
})
export type RecordListenInput = z.infer<typeof RecordListenSchema>

export const RecordListenResponseSchema = z.object({
  /** False when this listener already counted a listen for this track today,
   * or the track isn't eligible for top-lists — never an error either way. */
  recorded: z.boolean(),
})
