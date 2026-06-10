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
