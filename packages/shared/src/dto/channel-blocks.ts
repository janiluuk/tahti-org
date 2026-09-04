// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'
import { AddonRenderItemSchema } from './addons.js'

export const CHANNEL_BLOCK_TYPES = ['LOGO', 'ADDON'] as const
export type ChannelBlockTypeInput = (typeof CHANNEL_BLOCK_TYPES)[number]

export const CHANNEL_BLOCK_WIDTHS = ['FULL', 'HALF', 'THIRD'] as const
export type ChannelBlockWidthInput = (typeof CHANNEL_BLOCK_WIDTHS)[number]

export const ChannelBlockIdParamSchema = z.object({
  id: z.string().min(1).max(64),
})

// LOGO -> { assetUrl }, ADDON -> { addonInstallId } — kept as a loose record
// (not a discriminated union) since configJson is stored as opaque Json and
// validated per-type at the point of use, same pattern as Addon.configJson.
export const ChannelBlockConfigSchema = z.record(z.string(), z.unknown())

export const CreateChannelBlockSchema = z.object({
  type: z.enum(CHANNEL_BLOCK_TYPES),
  width: z.enum(CHANNEL_BLOCK_WIDTHS).default('FULL'),
  configJson: ChannelBlockConfigSchema.default({}),
})
export type CreateChannelBlockInput = z.infer<typeof CreateChannelBlockSchema>

export const PatchChannelBlockSchema = z
  .object({
    width: z.enum(CHANNEL_BLOCK_WIDTHS).optional(),
    position: z.number().int().min(0).max(999).optional(),
    configJson: ChannelBlockConfigSchema.optional(),
  })
  .refine((b) => Object.keys(b).length > 0, { message: 'No fields to update' })
export type PatchChannelBlockInput = z.infer<typeof PatchChannelBlockSchema>

export const ChannelBlockViewSchema = z.object({
  id: z.string(),
  type: z.enum(CHANNEL_BLOCK_TYPES),
  width: z.enum(CHANNEL_BLOCK_WIDTHS),
  position: z.number().int(),
  configJson: z.unknown(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})
export type ChannelBlockView = z.infer<typeof ChannelBlockViewSchema>

export const ChannelBlockListSchema = z.object({
  blocks: z.array(ChannelBlockViewSchema),
})

// Public render feed (GET /api/v1/channels/:slug/blocks) — resolved,
// render-ready shape, distinct from ChannelBlockView (the artist-management
// shape from me/channel-blocks.ts). An ADDON block whose install was
// removed/disabled since it was placed is dropped by the API rather than
// sent broken, so this never needs a "missing" variant.
export const ChannelBlockRenderItemSchema = z.discriminatedUnion('type', [
  z.object({
    id: z.string(),
    type: z.literal('LOGO'),
    width: z.enum(CHANNEL_BLOCK_WIDTHS),
    position: z.number().int(),
    assetUrl: z.string(),
  }),
  z.object({
    id: z.string(),
    type: z.literal('ADDON'),
    width: z.enum(CHANNEL_BLOCK_WIDTHS),
    position: z.number().int(),
    addon: AddonRenderItemSchema,
  }),
])
export type ChannelBlockRenderItem = z.infer<typeof ChannelBlockRenderItemSchema>

export const ChannelBlockRenderListSchema = z.object({
  blocks: z.array(ChannelBlockRenderItemSchema),
})
