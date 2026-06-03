// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const ChannelSchedulePatchSchema = z.object({
  nextBroadcastAt: z.string().datetime().nullable().optional(),
  nextBroadcastNote: z.string().max(200).nullable().optional(),
})

export type ChannelSchedulePatch = z.infer<typeof ChannelSchedulePatchSchema>
