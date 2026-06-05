// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@tahti/ui'

export function GalleryShell({
  children,
  label,
  controls,
  height = 360,
  className,
  style,
}: {
  children: ReactNode
  label: string
  controls?: ReactNode
  height?: number
  className?: string
  style?: CSSProperties
}) {
  return (
    <div className={cn('ch-gallery-shell', className)} style={style} aria-label={label}>
      <div className="ch-gallery-host" style={{ ['--ch-gallery-height' as string]: `${height}px` }}>
        {children}
      </div>
      {controls ? <div className="ch-gallery-controls">{controls}</div> : null}
    </div>
  )
}

export function GalleryNavButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <button type="button" className="ch-gallery-nav-btn" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  )
}
