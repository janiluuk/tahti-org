// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/**
 * WebGL image gallery modes inspired by examples on
 * https://freefrontend.com/three-js/ (MIT-licensed demos).
 */

export const WEBGL_GALLERY_MODES = [
  'TWISTED_WAVE_GLSL',
  'ZOOM_BLUR_GLSL',
  'RGB_SHIFT_GLSL',
  'POSTER_WALL_GLSL',
  'SHATTER_CAROUSEL_GLSL',
] as const

export type WebGLGalleryMode = (typeof WEBGL_GALLERY_MODES)[number]

export const GALLERY_SOURCE_URL = 'https://freefrontend.com/three-js/'

export const GALLERY_MODE_META: Record<
  WebGLGalleryMode,
  { label: string; source: string; blurb: string }
> = {
  TWISTED_WAVE_GLSL: {
    label: 'Twisted Wave (WebGL)',
    source: 'Twisted Wave GLSL Image Gallery',
    blurb: 'Sine-wave hover distortion + scroll radial warp.',
  },
  ZOOM_BLUR_GLSL: {
    label: 'Cinematic Zoom Blur (WebGL)',
    source: 'Cinematic Zoom Blur Image Gallery',
    blurb: 'Radial zoom-blur transitions between slides.',
  },
  RGB_SHIFT_GLSL: {
    label: 'RGB Shift strip (WebGL)',
    source: 'WebGL RGB Shift Image Card',
    blurb: 'Chromatic aberration on hover across a horizontal strip.',
  },
  POSTER_WALL_GLSL: {
    label: 'Poster scroll wall (WebGL)',
    source: 'Infinite 3D Poster Scroll Wall',
    blurb: 'Tilted infinite-scroll poster grid.',
  },
  SHATTER_CAROUSEL_GLSL: {
    label: 'Shatter carousel (WebGL)',
    source: 'Shattering Image Gallery Transition',
    blurb: 'Grid shatter transition between photos.',
  },
}

export type GalleryImagesProps = { images: string[] }
