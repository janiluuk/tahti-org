// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const CHANNEL_BLOCK_TYPES = ['LOGO', 'ADDON'] as const
export type ChannelBlockTypeInput = (typeof CHANNEL_BLOCK_TYPES)[number]

export const CHANNEL_BLOCK_WIDTHS = ['FULL', 'HALF', 'THIRD'] as const
export type ChannelBlockWidthInput = (typeof CHANNEL_BLOCK_WIDTHS)[number]

// LOGO -> { assetUrl }, ADDON -> { addonInstallId } — kept as a loose record
// (not a discriminated union) since configJson is stored as opaque Json and
// validated per-type at the point of use, same pattern as Addon.configJson.
export const ChannelBlockConfigSchema = z.record(z.unknown())

export const ChannelBlockSchema = z.object({
  id: z.string(),
  channelId: z.string(),
  type: z.enum(CHANNEL_BLOCK_TYPES),
  width: z.enum(CHANNEL_BLOCK_WIDTHS),
  position: z.number().int(),
  configJson: ChannelBlockConfigSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type ChannelBlock = z.infer<typeof ChannelBlockSchema>

export const ChannelBlockListSchema = z.object({
  blocks: z.array(ChannelBlockSchema),
})

export const CreateChannelBlockSchema = z.object({
  type: z.enum(CHANNEL_BLOCK_TYPES),
  width: z.enum(CHANNEL_BLOCK_WIDTHS).default('FULL'),
  configJson: ChannelBlockConfigSchema.default({}),
})
export type CreateChannelBlockInput = z.infer<typeof CreateChannelBlockSchema>

// All optional — patch semantics.
export const PatchChannelBlockSchema = z.object({
  width: z.enum(CHANNEL_BLOCK_WIDTHS).optional(),
  position: z.number().int().min(0).optional(),
  configJson: ChannelBlockConfigSchema.optional(),
})
export type PatchChannelBlockInput = z.infer<typeof PatchChannelBlockSchema>
