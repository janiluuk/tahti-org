// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

/** PLAT-086: whether the channel page starts playing on its own. */
export const ChannelAutoplaySchema = z.object({
  autoplayEnabled: z.boolean(),
})
export type ChannelAutoplayInput = z.infer<typeof ChannelAutoplaySchema>
