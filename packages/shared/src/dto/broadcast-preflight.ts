// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const BroadcastVisibilitySchema = z.enum(['PUBLIC', 'FAN_ONLY'])

export type BroadcastVisibility = z.infer<typeof BroadcastVisibilitySchema>

export const PatchBroadcastPreflightSchema = z.object({
  title: z.string().trim().min(1, 'title is required').max(140).optional(),
  visibility: BroadcastVisibilitySchema.optional(),
  autoArchive: z.boolean().optional(),
})

export type PatchBroadcastPreflightInput = z.infer<typeof PatchBroadcastPreflightSchema>

export const BroadcastPreflightViewSchema = z.object({
  title: z.string().nullable(),
  visibility: BroadcastVisibilitySchema,
  autoArchive: z.boolean(),
})

export type BroadcastPreflightView = z.infer<typeof BroadcastPreflightViewSchema>
