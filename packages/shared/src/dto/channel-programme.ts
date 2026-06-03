// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const FALLBACK_MODES = ['shuffle', 'ordered'] as const
export type FallbackMode = (typeof FALLBACK_MODES)[number]

export const ChannelProgrammeItemPatchSchema = z.object({
  archiveItemId: z.string().min(1),
  isFallback: z.boolean(),
  fallbackOrder: z.number().int().min(0).optional(),
})

export const ChannelProgrammePatchSchema = z.object({
  fallbackMode: z.enum(FALLBACK_MODES).optional(),
  items: z.array(ChannelProgrammeItemPatchSchema).max(200).optional(),
})

export type ChannelProgrammePatch = z.infer<typeof ChannelProgrammePatchSchema>
