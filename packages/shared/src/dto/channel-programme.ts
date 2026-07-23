// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const FALLBACK_MODES = ['shuffle', 'ordered', 'time', 'name'] as const
export type FallbackMode = (typeof FALLBACK_MODES)[number]

/** Artist-facing cap on the 24/7 rotation (isFallback=true archive items) —
 * keeps a single channel's offline loop from growing unbounded and keeps the
 * "which track gets swapped out" UX tractable (one candidate, not a list). */
export const MAX_FALLBACK_ITEMS = 5

export const ChannelProgrammeItemPatchSchema = z.object({
  archiveItemId: z.string().min(1),
  isFallback: z.boolean(),
  fallbackOrder: z.number().int().min(0).optional(),
})

export const ChannelProgrammePatchSchema = z.object({
  fallbackMode: z.enum(FALLBACK_MODES).optional(),
  fallbackEnabled: z.boolean().optional(),
  /** Whether new uploads auto-join the rotation (subject to MAX_FALLBACK_ITEMS). */
  fallbackAutoEnroll: z.boolean().optional(),
  items: z.array(ChannelProgrammeItemPatchSchema).max(200).optional(),
})

export type ChannelProgrammePatch = z.infer<typeof ChannelProgrammePatchSchema>

export const ChannelProgrammePromoteSchema = z.object({
  releaseTrackId: z.string().min(1),
})

export type ChannelProgrammePromote = z.infer<typeof ChannelProgrammePromoteSchema>
