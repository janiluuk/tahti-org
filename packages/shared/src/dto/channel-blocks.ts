// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'
import { CHANNEL_BLOCK_TYPES, CHANNEL_BLOCK_WIDTHS } from '../channel-block-pack.js'
import { AddonRenderItemSchema } from './addons.js'

export const ChannelBlockTypeSchema = z.enum(CHANNEL_BLOCK_TYPES)
export const ChannelBlockWidthSchema = z.enum(CHANNEL_BLOCK_WIDTHS)

/** Media object key from `/api/me/media` plus the resolved public URL. */
export const LogoBlockConfigSchema = z.object({
  assetId: z.string().trim().min(1).max(512),
  url: z
    .string()
    .url()
    .max(2048)
    .refine((value) => {
      try {
        const protocol = new URL(value).protocol
        return protocol === 'https:' || protocol === 'http:'
      } catch {
        return false
      }
    }, 'Logo URL must be http(s)'),
})
export type LogoBlockConfig = z.infer<typeof LogoBlockConfigSchema>

export const AddonBlockConfigSchema = z.object({
  addonInstallId: z.string().trim().min(1).max(64),
})
export type AddonBlockConfig = z.infer<typeof AddonBlockConfigSchema>

export const ChannelBlockConfigSchema = z.union([LogoBlockConfigSchema, AddonBlockConfigSchema])
export type ChannelBlockConfig = z.infer<typeof ChannelBlockConfigSchema>

export const CreateChannelBlockSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('LOGO'),
    width: ChannelBlockWidthSchema.optional(),
    configJson: LogoBlockConfigSchema,
  }),
  z.object({
    type: z.literal('ADDON'),
    width: ChannelBlockWidthSchema.optional(),
    configJson: AddonBlockConfigSchema,
  }),
])
export type CreateChannelBlockInput = z.infer<typeof CreateChannelBlockSchema>

export const PatchChannelBlockSchema = z
  .object({
    width: ChannelBlockWidthSchema.optional(),
    position: z.number().int().min(0).max(999).optional(),
    configJson: ChannelBlockConfigSchema.optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: 'No fields to update' })
export type PatchChannelBlockInput = z.infer<typeof PatchChannelBlockSchema>

export const ReorderChannelBlocksSchema = z.object({
  ids: z.array(z.string().min(1).max(64)).min(1).max(100),
})
export type ReorderChannelBlocksInput = z.infer<typeof ReorderChannelBlocksSchema>

export const ChannelBlockViewSchema = z.object({
  id: z.string(),
  type: ChannelBlockTypeSchema,
  width: ChannelBlockWidthSchema,
  position: z.number().int(),
  configJson: z.unknown(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})
export type ChannelBlockView = z.infer<typeof ChannelBlockViewSchema>

export const ChannelBlockListSchema = z.object({
  blocks: z.array(ChannelBlockViewSchema),
})

/** Public render payload — logo URL and/or addon sandbox fields, never raw config. */
export const PublicChannelBlockSchema = z.object({
  id: z.string(),
  type: ChannelBlockTypeSchema,
  width: ChannelBlockWidthSchema,
  position: z.number().int(),
  logoUrl: z.string().nullable(),
  addon: AddonRenderItemSchema.nullable(),
})
export type PublicChannelBlock = z.infer<typeof PublicChannelBlockSchema>

export const PublicChannelBlockListSchema = z.object({
  blocks: z.array(PublicChannelBlockSchema),
})

export const MAX_CHANNEL_BLOCKS = 40
