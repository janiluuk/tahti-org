// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

// M26: per-collection backdrop themes — same effect catalogue as the channel
// gallery/text-layer pickers (packages/shared/src/dto/channel-gallery.ts and
// channel-text-layer.ts), reused so a collection (album, mix series) can carry
// its own theme independent of the artist's channel-wide theme.

export const COLLECTION_GALLERY_MODES = [
  'NONE',
  'STATIC_SLIDESHOW',
  'TWISTED_WAVE_GLSL',
  'ZOOM_BLUR_GLSL',
  'RGB_SHIFT_GLSL',
  'POSTER_WALL_GLSL',
  'SHATTER_CAROUSEL_GLSL',
] as const

export type CollectionGalleryMode = (typeof COLLECTION_GALLERY_MODES)[number]

export const COLLECTION_GALLERY_MODE_LABELS: Record<CollectionGalleryMode, string> = {
  NONE: 'No gallery',
  STATIC_SLIDESHOW: 'Static image strip',
  TWISTED_WAVE_GLSL: 'Twisted Wave (WebGL)',
  ZOOM_BLUR_GLSL: 'Cinematic Zoom Blur (WebGL)',
  RGB_SHIFT_GLSL: 'RGB Shift strip (WebGL)',
  POSTER_WALL_GLSL: 'Poster scroll wall (WebGL)',
  SHATTER_CAROUSEL_GLSL: 'Shatter carousel (WebGL)',
}

export const COLLECTION_GALLERY_MODE_HINTS: Partial<Record<CollectionGalleryMode, string>> = {
  TWISTED_WAVE_GLSL: 'Hover ripple + scroll warp (Twisted Wave GLSL Image Gallery)',
  ZOOM_BLUR_GLSL: 'Radial zoom-blur slide transitions (Cinematic Zoom Blur Image Gallery)',
  RGB_SHIFT_GLSL: 'Chromatic split on hover (WebGL RGB Shift Image Card)',
  POSTER_WALL_GLSL: 'Tilted auto-scrolling poster grid (Infinite 3D Poster Scroll Wall)',
  SHATTER_CAROUSEL_GLSL: 'Grid shatter between slides (Shattering Image Gallery Transition)',
}

export const CollectionGalleryPatchSchema = z.object({
  galleryMode: z.enum(COLLECTION_GALLERY_MODES).optional(),
  slideshowImages: z.array(z.string().url().max(2048)).max(10).optional(),
  /** HTTPS image or YouTube/Vimeo watch URL for the full-width collection backdrop */
  videoBackgroundUrl: z.string().max(2048).nullable().optional(),
})

export type CollectionGalleryPatch = z.infer<typeof CollectionGalleryPatchSchema>

/** True when mode renders WebGL (needs CORS-friendly image URLs). */
export function isWebGLCollectionGalleryMode(mode: CollectionGalleryMode): boolean {
  return mode.endsWith('_GLSL')
}

export const COLLECTION_TEXT_LAYER_MODES = [
  'NONE',
  'GRADIENT_SHIMMER',
  'COSMIC_NEON',
  'LAYERED_WAVE_3D',
  'SHIMMER_LINES',
  'GHOST_ECHO',
] as const

export type CollectionTextLayerMode = (typeof COLLECTION_TEXT_LAYER_MODES)[number]

export const COLLECTION_TEXT_LAYER_ALIGNMENTS = ['LEFT', 'CENTER', 'RIGHT'] as const

export type CollectionTextLayerAlignment = (typeof COLLECTION_TEXT_LAYER_ALIGNMENTS)[number]

export const COLLECTION_TEXT_LAYER_MODE_LABELS: Record<CollectionTextLayerMode, string> = {
  NONE: 'No text layer',
  GRADIENT_SHIMMER: 'Animated gradient shimmer',
  COSMIC_NEON: 'Cosmic neon glow',
  LAYERED_WAVE_3D: '3D layered wave',
  SHIMMER_LINES: 'Shimmer lines',
  GHOST_ECHO: 'Ghost echo',
}

export const COLLECTION_TEXT_LAYER_MODE_HINTS: Partial<Record<CollectionTextLayerMode, string>> = {
  GRADIENT_SHIMMER: 'Moving gradient clipped to letter shapes (Animated Gradient Text)',
  COSMIC_NEON: 'Multi-color neon glow on hover (Cosmic Neon Text Effect)',
  LAYERED_WAVE_3D: 'Stacked parallax layers follow the cursor (Interactive 3D Layered Text Wave)',
  SHIMMER_LINES: 'Diagonal light bands sweep across the text (Text Shimmer Lines Effect)',
  GHOST_ECHO: 'Vertical ghost shadows fade outward (Vertical Ghost Text Hover Effect)',
}

export const COLLECTION_TEXT_LAYER_ALIGN_LABELS: Record<CollectionTextLayerAlignment, string> = {
  LEFT: 'Left',
  CENTER: 'Center',
  RIGHT: 'Right',
}

export const CollectionTextLayerPatchSchema = z.object({
  textLayerMode: z.enum(COLLECTION_TEXT_LAYER_MODES).optional(),
  textLayerText: z.string().trim().max(120).optional(),
  textLayerAlign: z.enum(COLLECTION_TEXT_LAYER_ALIGNMENTS).optional(),
})

export type CollectionTextLayerPatch = z.infer<typeof CollectionTextLayerPatchSchema>

export const CollectionTextLayerPublicSchema = z.object({
  textLayerMode: z.enum(COLLECTION_TEXT_LAYER_MODES),
  textLayerText: z.string().max(120),
  textLayerAlign: z.enum(COLLECTION_TEXT_LAYER_ALIGNMENTS),
})

export type CollectionTextLayerPublic = z.infer<typeof CollectionTextLayerPublicSchema>

export function isActiveCollectionTextLayer(
  layer: Pick<CollectionTextLayerPublic, 'textLayerMode' | 'textLayerText'>,
): boolean {
  return layer.textLayerMode !== 'NONE' && layer.textLayerText.trim().length > 0
}
