// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import { z } from 'zod'

/** Text layer modes inspired by freefrontend.com/css-text-effects (MIT demos). */
export const CHANNEL_TEXT_LAYER_MODES = [
  'NONE',
  'GRADIENT_SHIMMER',
  'COSMIC_NEON',
  'LAYERED_WAVE_3D',
  'SHIMMER_LINES',
  'GHOST_ECHO',
] as const

export type ChannelTextLayerMode = (typeof CHANNEL_TEXT_LAYER_MODES)[number]

export const CHANNEL_TEXT_LAYER_ALIGNMENTS = ['LEFT', 'CENTER', 'RIGHT'] as const

export type ChannelTextLayerAlignment = (typeof CHANNEL_TEXT_LAYER_ALIGNMENTS)[number]

export const CHANNEL_TEXT_LAYER_SOURCE_URL = 'https://freefrontend.com/css-text-effects/'

export const CHANNEL_TEXT_LAYER_MODE_LABELS: Record<ChannelTextLayerMode, string> = {
  NONE: 'No text layer',
  GRADIENT_SHIMMER: 'Animated gradient shimmer',
  COSMIC_NEON: 'Cosmic neon glow',
  LAYERED_WAVE_3D: '3D layered wave',
  SHIMMER_LINES: 'Shimmer lines',
  GHOST_ECHO: 'Ghost echo',
}

export const CHANNEL_TEXT_LAYER_MODE_HINTS: Partial<Record<ChannelTextLayerMode, string>> = {
  GRADIENT_SHIMMER: 'Moving gradient clipped to letter shapes (Animated Gradient Text)',
  COSMIC_NEON: 'Multi-color neon glow on hover (Cosmic Neon Text Effect)',
  LAYERED_WAVE_3D: 'Stacked parallax layers follow the cursor (Interactive 3D Layered Text Wave)',
  SHIMMER_LINES: 'Diagonal light bands sweep across the text (Text Shimmer Lines Effect)',
  GHOST_ECHO: 'Vertical ghost shadows fade outward (Vertical Ghost Text Hover Effect)',
}

export const CHANNEL_TEXT_LAYER_ALIGN_LABELS: Record<ChannelTextLayerAlignment, string> = {
  LEFT: 'Left',
  CENTER: 'Center',
  RIGHT: 'Right',
}

export const ChannelTextLayerPatchSchema = z.object({
  textLayerMode: z.enum(CHANNEL_TEXT_LAYER_MODES).optional(),
  textLayerText: z.string().trim().max(120).optional(),
  textLayerAlign: z.enum(CHANNEL_TEXT_LAYER_ALIGNMENTS).optional(),
})

export type ChannelTextLayerPatch = z.infer<typeof ChannelTextLayerPatchSchema>

export const ChannelTextLayerPublicSchema = z.object({
  textLayerMode: z.enum(CHANNEL_TEXT_LAYER_MODES),
  textLayerText: z.string().max(120),
  textLayerAlign: z.enum(CHANNEL_TEXT_LAYER_ALIGNMENTS),
})

export type ChannelTextLayerPublic = z.infer<typeof ChannelTextLayerPublicSchema>

export function isActiveTextLayer(
  layer: Pick<ChannelTextLayerPublic, 'textLayerMode' | 'textLayerText'>,
): boolean {
  return layer.textLayerMode !== 'NONE' && layer.textLayerText.trim().length > 0
}
