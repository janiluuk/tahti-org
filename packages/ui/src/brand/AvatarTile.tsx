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
  alt?: string
  gradient?: CoverGradient
  /** Profile-style ring against page background. */
  bordered?: boolean
  className?: string
}

/** Circular avatar — photo or initials on a canonical gradient. */
export function AvatarTile({
  size,
  name,
  src,
  alt,
  gradient = 'aurora',
  bordered = false,
  className,
}: AvatarTileProps) {
  const label = alt ?? name
  const classes = cn(
    'avatar-tile',
    `avatar-tile--${size}`,
    !src && `avatar-tile--${gradient}`,
    bordered && 'avatar-tile--bordered',
    className,
  )

  if (src) {
    return <img src={src} alt={label} className={classes} loading="lazy" decoding="async" />
  }

  return (
    <div className={classes} role="img" aria-label={label}>
      <span className="avatar-tile__initials" aria-hidden>
        {initialsFromName(name)}
      </span>
    </div>
  )
}
