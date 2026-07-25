// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import type { ChannelGalleryMode } from '@tahti/shared'
import { PosterWallGallery } from './poster-wall-gallery'
import { RgbShiftGallery } from './rgb-shift-gallery'
import { ShatterCarouselGallery } from './shatter-carousel-gallery'
import { StaticSlideshowGallery } from './static-slideshow-gallery'
import { TwistedWaveGallery } from './twisted-wave-gallery'
import { ZoomBlurGallery } from './zoom-blur-gallery'

export function ChannelGalleryView({
  mode,
  images,
  analyser,
}: {
  mode: ChannelGalleryMode
  images: string[]
  analyser?: AnalyserNode | null
}) {
  if (mode === 'NONE' || images.length === 0) return null

  switch (mode) {
    case 'STATIC_SLIDESHOW':
      return <StaticSlideshowGallery images={images} />
    case 'TWISTED_WAVE_GLSL':
      return <TwistedWaveGallery images={images} analyser={analyser} />
    case 'ZOOM_BLUR_GLSL':
      return <ZoomBlurGallery images={images} analyser={analyser} />
    case 'RGB_SHIFT_GLSL':
      return <RgbShiftGallery images={images} analyser={analyser} />
    case 'POSTER_WALL_GLSL':
      return <PosterWallGallery images={images} analyser={analyser} />
    case 'SHATTER_CAROUSEL_GLSL':
      return <ShatterCarouselGallery images={images} analyser={analyser} />
    default:
      return null
  }
}

export {
  TwistedWaveGallery,
  ZoomBlurGallery,
  RgbShiftGallery,
  PosterWallGallery,
  ShatterCarouselGallery,
  StaticSlideshowGallery,
}
