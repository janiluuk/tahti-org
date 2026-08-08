// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'
import { CHANNEL_GALLERY_MODES } from './channel-gallery.js'

// M31: Three.js ambient visualizer presets

export const VISUAL_PRESETS = [
  'MINIMAL',
  'WATER_RIPPLE',
  'WAVEFORM_BARS',
  'PARTICLE_FIELD',
  'AURORA',
  'REACTIVE_GRID',
  'CLOUDSCAPE',
  'LINE_TANGLE',
  'BACKDROP_BOX',
  'LENS_FLARES',
  'IES_SPOTLIGHT',
] as const

export type VisualPreset = (typeof VISUAL_PRESETS)[number]

export const VISUAL_PRESET_LABELS: Record<VisualPreset, string> = {
  MINIMAL: 'None',
  WATER_RIPPLE: 'Water ripple',
  WAVEFORM_BARS: 'Waveform bars',
  PARTICLE_FIELD: 'Particle field',
  AURORA: 'Aurora',
  REACTIVE_GRID: 'Reactive grid',
  CLOUDSCAPE: 'Cloudscape',
  LINE_TANGLE: 'Line tangle',
  BACKDROP_BOX: 'Backdrop box',
  LENS_FLARES: 'Lens flares',
  IES_SPOTLIGHT: 'Spotlight',
}

export const VISUAL_PRESET_DESCRIPTIONS: Record<VisualPreset, string> = {
  MINIMAL: 'No background visualizer.',
  WATER_RIPPLE:
    'Your cover art rippling like water, with drops that grow and speed up with the music.',
  WAVEFORM_BARS: 'Animated frequency bars in your accent color.',
  PARTICLE_FIELD: 'Drifting particle cloud in your color palette.',
  AURORA: 'Slow aurora-borealis color wash.',
  REACTIVE_GRID: 'Pulsing grid that reacts to your palette.',
  CLOUDSCAPE: 'Slow-drifting clouds over water, with a subtle audio-reactive glow.',
  LINE_TANGLE: 'A tangled 3D web of colored lines, slowly rotating.',
  BACKDROP_BOX: 'A translucent glass box whose zoom, angle, and size breathe subtly.',
  LENS_FLARES: 'Drifting bursts of light that swiftly change direction.',
  IES_SPOTLIGHT:
    'Spotlights hover near center with a subtle zoom, glowing brighter with the music.',
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

export const SLIDESHOW_PRESETS = [
  'FADE',
  'ZOOM',
  'PAN',
  'BLUR_CROSS',
  // WebGL (Three.js) presets — richer tier alongside the CSS ones above.
  'PARTICLE_DISSOLVE',
  'GLITCH_WIPE',
  'CUBE_FLIP',
  'LIQUID_DISTORTION',
] as const
export type SlideshowPreset = (typeof SLIDESHOW_PRESETS)[number]

/** Presets rendered via WebGL (Three.js) rather than plain CSS keyframes — used by
 * ChannelSlideshow to decide whether to mount the (heavier, lazy-loaded) Three.js
 * transition overlay instead of the CSS crossfade. */
export const WEBGL_SLIDESHOW_PRESETS = new Set<SlideshowPreset>([
  'PARTICLE_DISSOLVE',
  'GLITCH_WIPE',
  'CUBE_FLIP',
  'LIQUID_DISTORTION',
])

export const SLIDESHOW_PRESET_LABELS: Record<SlideshowPreset, string> = {
  FADE: 'Fade',
  ZOOM: 'Zoom',
  PAN: 'Pan',
  BLUR_CROSS: 'Blur crossfade',
  PARTICLE_DISSOLVE: 'Particle dissolve',
  GLITCH_WIPE: 'Glitch wipe',
  CUBE_FLIP: 'Cube flip',
  LIQUID_DISTORTION: 'Liquid distortion',
}

export const SLIDESHOW_PRESET_DESCRIPTIONS: Record<SlideshowPreset, string> = {
  FADE: 'Simple crossfade.',
  ZOOM: 'Slow zoom while crossfading.',
  PAN: 'Slides sideways while crossfading.',
  BLUR_CROSS: 'Crossfades through a soft blur.',
  PARTICLE_DISSOLVE: 'The image breaks apart into drifting particles as the next one resolves.',
  GLITCH_WIPE: 'A digital glitch band sweeps across, revealing the next image.',
  CUBE_FLIP: 'The banner rotates in 3D like a turning cube face.',
  LIQUID_DISTORTION: 'A rippling liquid distortion washes the next image into view.',
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

/** Per-visualizer knobs (speed / intensity). Stored as a map keyed by preset. */
export const VisualPresetSettingsSchema = z.object({
  speed: z.number().min(0.25).max(2),
  intensity: z.number().min(0.25).max(2),
})

export type VisualPresetSettings = z.infer<typeof VisualPresetSettingsSchema>

export const DEFAULT_VISUAL_PRESET_SETTINGS: VisualPresetSettings = {
  speed: 1,
  intensity: 1,
}

export const VisualSettingsMapSchema = z.record(z.string(), VisualPresetSettingsSchema.partial())

export type VisualSettingsMap = z.infer<typeof VisualSettingsMapSchema>

export function parseVisualSettingsMap(json: string | null | undefined): VisualSettingsMap {
  if (!json) return {}
  try {
    const parsed = VisualSettingsMapSchema.safeParse(JSON.parse(json))
    return parsed.success ? parsed.data : {}
  } catch {
    return {}
  }
}

export function resolveVisualPresetSettings(
  map: VisualSettingsMap | null | undefined,
  preset: VisualPreset,
): VisualPresetSettings {
  const partial = map?.[preset]
  return {
    speed: partial?.speed ?? DEFAULT_VISUAL_PRESET_SETTINGS.speed,
    intensity: partial?.intensity ?? DEFAULT_VISUAL_PRESET_SETTINGS.intensity,
  }
}

/** Compact strip favorites shown beside the gallery entry — not the full catalog. */
export const VISUAL_PRESET_STRIP: VisualPreset[] = [
  'MINIMAL',
  'WATER_RIPPLE',
  'WAVEFORM_BARS',
  'AURORA',
  'PARTICLE_FIELD',
]

export const ChannelVisualPatchSchema = z.object({
  visualPreset: z.enum(VISUAL_PRESETS).optional(),
  colorScheme: ColorSchemeSchema.nullable().optional(),
  /** Map of preset → { speed, intensity }. Null clears all overrides. */
  visualSettings: VisualSettingsMapSchema.nullable().optional(),
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
  slideshowImages: z.array(z.string().url().max(2048)).max(10).optional(),
  galleryMode: z.enum(CHANNEL_GALLERY_MODES).optional(),
  galleryAudioReactive: z.boolean().optional(),
})

export type ReleaseVisualPatch = z.infer<typeof ReleaseVisualPatchSchema>

export const ArchiveItemVisualPatchSchema = z.object({
  visualPreset: z.enum(VISUAL_PRESETS).optional(),
  colorScheme: ColorSchemeSchema.nullable().optional(),
})

export type ArchiveItemVisualPatch = z.infer<typeof ArchiveItemVisualPatchSchema>
