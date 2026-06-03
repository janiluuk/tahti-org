// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

/** All channel gallery modes (static + 5 WebGL styles from freefrontend.com/three-js). */
export const CHANNEL_GALLERY_MODES = [
  'NONE',
  'STATIC_SLIDESHOW',
  'TWISTED_WAVE_GLSL',
  'ZOOM_BLUR_GLSL',
  'RGB_SHIFT_GLSL',
  'POSTER_WALL_GLSL',
  'SHATTER_CAROUSEL_GLSL',
] as const

export type ChannelGalleryMode = (typeof CHANNEL_GALLERY_MODES)[number]

export const CHANNEL_GALLERY_SOURCE_URL = 'https://freefrontend.com/three-js/'

export const CHANNEL_GALLERY_MODE_LABELS: Record<ChannelGalleryMode, string> = {
  NONE: 'No gallery',
  STATIC_SLIDESHOW: 'Static image strip',
  TWISTED_WAVE_GLSL: 'Twisted Wave (WebGL)',
  ZOOM_BLUR_GLSL: 'Cinematic Zoom Blur (WebGL)',
  RGB_SHIFT_GLSL: 'RGB Shift strip (WebGL)',
  POSTER_WALL_GLSL: 'Poster scroll wall (WebGL)',
  SHATTER_CAROUSEL_GLSL: 'Shatter carousel (WebGL)',
}

/** Short helper shown in dashboard when a WebGL mode is selected. */
export const CHANNEL_GALLERY_MODE_HINTS: Partial<Record<ChannelGalleryMode, string>> = {
  TWISTED_WAVE_GLSL: 'Hover ripple + scroll warp (Twisted Wave GLSL Image Gallery)',
  ZOOM_BLUR_GLSL: 'Radial zoom-blur slide transitions (Cinematic Zoom Blur Image Gallery)',
  RGB_SHIFT_GLSL: 'Chromatic split on hover (WebGL RGB Shift Image Card)',
  POSTER_WALL_GLSL: 'Tilted auto-scrolling poster grid (Infinite 3D Poster Scroll Wall)',
  SHATTER_CAROUSEL_GLSL: 'Grid shatter between slides (Shattering Image Gallery Transition)',
}

export const ChannelGalleryPatchSchema = z.object({
  galleryMode: z.enum(CHANNEL_GALLERY_MODES).optional(),
  slideshowImages: z.array(z.string().url().max(2048)).max(10).optional(),
  /** M26: HTTPS image or YouTube/Vimeo watch URL for full-width channel backdrop */
  videoBackgroundUrl: z.string().max(2048).nullable().optional(),
})

export type ChannelGalleryPatch = z.infer<typeof ChannelGalleryPatchSchema>

/** Parse image URL lines from dashboard textarea (http/https only). */
export function parseGalleryImageLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^https?:\/\//i.test(line))
    .slice(0, 10)
}

/** True when mode renders WebGL (needs CORS-friendly image URLs). */
export function isWebGLGalleryMode(mode: ChannelGalleryMode): boolean {
  return mode.endsWith('_GLSL')
}
