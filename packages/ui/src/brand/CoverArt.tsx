// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import React from 'react'
import { cn } from '../lib/cn'
import type { CoverGradient } from '../lib/cover-gradient'

/** Square cover-art sizes used across channel, smart link, and dashboard lists. */
export type CoverArtSize = 'xs' | 'sm' | 'md' | 'lg' | 'full'

const COVER_ART_PX: Record<Exclude<CoverArtSize, 'full'>, number> = {
  xs: 24,
  sm: 46,
  md: 80,
  lg: 140,
}

export interface CoverArtProps {
  size: CoverArtSize
  /** When set, renders the artwork image instead of a gradient placeholder. */
  src?: string | null
  alt?: string
  /** Placeholder gradient when `src` is absent. */
  gradient?: CoverGradient
  className?: string
}

/** Square release / track cover — image or canonical gradient placeholder. */
export function CoverArt({ size, src, alt = '', gradient = 'aurora', className }: CoverArtProps) {
  const sizeClass = `cover-art--${size}`
  const classes = cn('cover-art', sizeClass, !src && `cover-art--${gradient}`, className)

  if (src) {
    const px = size === 'full' ? 280 : COVER_ART_PX[size]
    return (
      <img
        src={src}
        alt={alt}
        className={classes}
        width={px}
        height={px}
        loading="lazy"
        decoding="async"
      />
    )
  }

  return (
    <div
      className={classes}
      role={alt ? 'img' : undefined}
      aria-label={alt || undefined}
      aria-hidden={!alt}
    />
  )
}
