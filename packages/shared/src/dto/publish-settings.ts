// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

/** Persistent per-channel default for a new broadcast's autoArchive value —
 * pairs with AutoRecordEnabledPatchSchema (recording-settings.ts) as the two
 * "what happens to a finished show" toggles. */
export const AutoPublishBroadcastPatchSchema = z.object({
  autoPublishBroadcast: z.boolean(),
})
export type AutoPublishBroadcastPatchInput = z.infer<typeof AutoPublishBroadcastPatchSchema>
