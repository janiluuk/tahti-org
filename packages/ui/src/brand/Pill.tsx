// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import React from 'react'
import { cn } from '../lib/cn'

export type PillVariant = 'live' | 'flac' | 'archive' | 'recommended' | 'default'

const PILL_DEFAULT_LABEL: Partial<Record<PillVariant, string>> = {
  live: 'LIVE',
  flac: 'FLAC',
  archive: 'ARCHIVE',
  recommended: 'RECOMMENDED',
}

export interface PillProps {
  variant: PillVariant
  children?: React.ReactNode
  className?: string
}

/** Semantic status pill — variant encodes meaning, not color. */
export function Pill({ variant, children, className }: PillProps) {
  const label = children ?? PILL_DEFAULT_LABEL[variant] ?? 'Label'

  if (variant === 'live') {
    return (
      <span className={cn('pill', 'pill--live', className)} role="status">
        <span className="pill__dot" aria-hidden />
        {label}
      </span>
    )
  }

  return <span className={cn('pill', `pill--${variant}`, className)}>{label}</span>
}
