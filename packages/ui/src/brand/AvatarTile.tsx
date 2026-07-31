// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import React from 'react'
import { cn } from '../lib/cn'
import type { CoverGradient } from '../lib/cover-gradient'
import { initialsFromName } from '../lib/initials'
import type { CoverArtSize } from './CoverArt'

export interface AvatarTileProps {
  size: CoverArtSize
  /** Display name — used for initials when `src` is absent. */
  name: string
  src?: string | null
  /** Static poster frame — when set alongside `src`, the tile shows this at
   * rest and swaps to `src` (the live/animated image) on hover. Pure CSS
   * opacity-crossfade, no JS: both images always load, only visibility
   * toggles. Ignored if `src` is absent. */
  posterUrl?: string | null
  alt?: string
  gradient?: CoverGradient
  /** CSS background (solid or gradient) — overrides the named `gradient` when set. */
  themeBackground?: string | null
  /** Alpha PNG/WebP logo printed on top of the fill / photo. */
  logoUrl?: string | null
  /** Profile-style ring against page background. */
  bordered?: boolean
  className?: string
}

/** Circular avatar — photo, themed fill + initials, and optional alpha logo. */
export function AvatarTile({
  size,
  name,
  src,
  posterUrl,
  alt,
  gradient = 'aurora',
  themeBackground,
  logoUrl,
  bordered = false,
  className,
}: AvatarTileProps) {
  const label = alt ?? name
  const themed = Boolean(themeBackground)
  const classes = cn(
    'avatar-tile',
    `avatar-tile--${size}`,
    !src && !themed && `avatar-tile--${gradient}`,
    themed && 'avatar-tile--themed',
    logoUrl && 'avatar-tile--has-logo',
    bordered && 'avatar-tile--bordered',
    className,
  )
  const style = themeBackground
    ? ({ ['--avatar-theme-bg' as string]: themeBackground } as React.CSSProperties)
    : undefined

  const logo = logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logoUrl} alt="" className="avatar-tile__logo" loading="lazy" decoding="async" />
  ) : null

  if (src && posterUrl) {
    return (
      <span
        className={cn(classes, 'avatar-tile--hover-animate')}
        style={style}
        role="img"
        aria-label={label}
      >
        <img
          src={posterUrl}
          alt=""
          className="avatar-tile__poster"
          loading="lazy"
          decoding="async"
        />
        <img src={src} alt="" className="avatar-tile__live" loading="lazy" decoding="async" />
        {logo}
      </span>
    )
  }

  if (src) {
    return (
      <span
        className={cn(classes, 'avatar-tile--photo')}
        style={style}
        role="img"
        aria-label={label}
      >
        <img src={src} alt="" className="avatar-tile__photo" loading="lazy" decoding="async" />
        {logo}
      </span>
    )
  }

  return (
    <div className={classes} style={style} role="img" aria-label={label}>
      {!logo && (
        <span className="avatar-tile__initials" aria-hidden>
          {initialsFromName(name)}
        </span>
      )}
      {logo}
    </div>
  )
}
