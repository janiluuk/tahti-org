// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

// M31: Three.js ambient visualizer presets

export const VISUAL_PRESETS = [
  'MINIMAL',
  'WAVEFORM_BARS',
  'PARTICLE_FIELD',
  'AURORA',
  'REACTIVE_GRID',
] as const

export type VisualPreset = (typeof VISUAL_PRESETS)[number]

export const VISUAL_PRESET_LABELS: Record<VisualPreset, string> = {
  MINIMAL: 'None',
  WAVEFORM_BARS: 'Waveform bars',
  PARTICLE_FIELD: 'Particle field',
  AURORA: 'Aurora',
  REACTIVE_GRID: 'Reactive grid',
}

export const VISUAL_PRESET_DESCRIPTIONS: Record<VisualPreset, string> = {
  MINIMAL: 'No background visualizer.',
  WAVEFORM_BARS: 'Animated frequency bars in your accent color.',
  PARTICLE_FIELD: 'Drifting particle cloud in your color palette.',
  AURORA: 'Slow aurora-borealis color wash.',
  REACTIVE_GRID: 'Pulsing grid that reacts to your palette.',
}

export const CHANNEL_HEADER_STYLES = ['GRADIENT', 'SOLID', 'VIDEO_LOOP'] as const
export type ChannelHeaderStyle = (typeof CHANNEL_HEADER_STYLES)[number]

export const CHANNEL_HEADER_STYLE_LABELS: Record<ChannelHeaderStyle, string> = {
  GRADIENT: 'gradient',
  SOLID: 'solid color',
  VIDEO_LOOP: 'video loop',
}

/** Fixed brand-accent gradient swatches (08-channel-designer.html "Brand accent").
 * `accent`/`highlight` feed the existing ColorScheme when a preset is selected. */
export interface BrandAccentPreset {
  id: string
  gradient: string
  accent: string
  highlight: string
}

export const BRAND_ACCENT_PRESETS: BrandAccentPreset[] = [
  {
    id: 'aurora',
    gradient: 'linear-gradient(135deg,#A78BFA,#22D3EE,#3FE07A)',
    accent: '#22D3EE',
    highlight: '#A78BFA',
  },
  {
    id: 'coral',
    gradient: 'linear-gradient(135deg,#F87171,#FFB840)',
    accent: '#FFB840',
    highlight: '#F87171',
  },
  {
    id: 'deep',
    gradient: 'linear-gradient(135deg,#5B6BC4,#22D3EE)',
    accent: '#22D3EE',
    highlight: '#5B6BC4',
  },
  {
    id: 'violet',
    gradient: 'linear-gradient(135deg,#8B5CF6,#6366F1)',
    accent: '#8B5CF6',
    highlight: '#6366F1',
  },
  {
    id: 'mint',
    gradient: 'linear-gradient(135deg,#3FE07A,#22D3EE)',
    accent: '#3FE07A',
    highlight: '#22D3EE',
  },
  {
    id: 'rose',
    gradient: 'linear-gradient(135deg,#F472B6,#8B5CF6)',
    accent: '#F472B6',
    highlight: '#8B5CF6',
  },
]

export const SLIDESHOW_PRESETS = ['FADE', 'ZOOM', 'PAN', 'BLUR_CROSS'] as const
export type SlideshowPreset = (typeof SLIDESHOW_PRESETS)[number]

export const SLIDESHOW_PRESET_LABELS: Record<SlideshowPreset, string> = {
  FADE: 'Fade',
  ZOOM: 'Zoom',
  PAN: 'Pan',
  BLUR_CROSS: 'Blur crossfade',
}

/** A 5-color palette extracted from cover art or set by the artist. */
export const ColorSchemeSchema = z.object({
  bg: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  text: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  muted: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  highlight: z.string().regex(/^#[0-9a-fA-F]{6}$/),
})

export type ColorScheme = z.infer<typeof ColorSchemeSchema>

/** Platform defaults used when no scheme is stored (v8 brand baseline). */
export const DEFAULT_COLOR_SCHEME: ColorScheme = {
  bg: '#0A0E1C',
  accent: '#22D3EE',
  text: '#E6E9F0',
  muted: '#A1A8BD',
  highlight: '#A78BFA',
}

export function parseColorScheme(json: string | null | undefined): ColorScheme | null {
  if (!json) return null
  try {
    const parsed = ColorSchemeSchema.safeParse(JSON.parse(json))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

export function resolveColorScheme(
  colorSchemeJson: string | null | undefined,
  paletteJson: string | null | undefined,
): ColorScheme {
  return parseColorScheme(colorSchemeJson) ?? parseColorScheme(paletteJson) ?? DEFAULT_COLOR_SCHEME
}

export const ChannelVisualPatchSchema = z.object({
  visualPreset: z.enum(VISUAL_PRESETS).optional(),
  colorScheme: ColorSchemeSchema.nullable().optional(),
  headerStyle: z.enum(CHANNEL_HEADER_STYLES).optional(),
  brandAccentPreset: z.string().nullable().optional(),
  slideshowPreset: z.enum(SLIDESHOW_PRESETS).optional(),
  slideshowIntervalSeconds: z.number().int().min(5).max(30).optional(),
  slideshowTransitionMs: z.number().int().min(300).max(1500).optional(),
  slideshowAutoplay: z.boolean().optional(),
})

export type ChannelVisualPatch = z.infer<typeof ChannelVisualPatchSchema>

export const ReleaseVisualPatchSchema = z.object({
  visualPreset: z.enum(VISUAL_PRESETS).optional(),
  colorScheme: ColorSchemeSchema.nullable().optional(),
})

export type ReleaseVisualPatch = z.infer<typeof ReleaseVisualPatchSchema>

export const ArchiveItemVisualPatchSchema = z.object({
  visualPreset: z.enum(VISUAL_PRESETS).optional(),
})

export type ArchiveItemVisualPatch = z.infer<typeof ArchiveItemVisualPatchSchema>
