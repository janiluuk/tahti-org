// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Prisma } from '@tahti/db'
import {
  AddonBlockConfigSchema,
  LogoBlockConfigSchema,
  type PublicChannelBlock,
} from '@tahti/shared'
import { publicMediaUrl } from './public-media-url.js'

export function sandboxUrlForBundle(bundleHash: string): string {
  return `/widget-sandbox/${bundleHash}`
}

export function parseLogoBlockConfig(config: Prisma.JsonValue | null | undefined) {
  const parsed = LogoBlockConfigSchema.safeParse(config)
  return parsed.success ? parsed.data : null
}

export function parseAddonBlockConfig(config: Prisma.JsonValue | null | undefined) {
  const parsed = AddonBlockConfigSchema.safeParse(config)
  return parsed.success ? parsed.data : null
}

export function resolveLogoBlockUrl(config: Prisma.JsonValue | null | undefined): string | null {
  const parsed = parseLogoBlockConfig(config)
  if (!parsed) return null
  if (parsed.url) return parsed.url
  return publicMediaUrl(parsed.assetId)
}

export function emptyPublicChannelBlock(input: {
  id: string
  type: PublicChannelBlock['type']
  width: PublicChannelBlock['width']
  position: number
}): PublicChannelBlock {
  return {
    id: input.id,
    type: input.type,
    width: input.width,
    position: input.position,
    logoUrl: null,
    addon: null,
  }
}
