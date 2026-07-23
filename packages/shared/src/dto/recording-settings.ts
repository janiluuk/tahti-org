// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

/** M35: per-channel opt-out of auto-recording a finished broadcast to the archive. */
export const AutoRecordEnabledPatchSchema = z.object({
  autoRecordEnabled: z.boolean(),
})
export type AutoRecordEnabledPatchInput = z.infer<typeof AutoRecordEnabledPatchSchema>
