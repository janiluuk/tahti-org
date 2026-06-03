// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import type { CSSProperties, ReactNode } from 'react'

export function GalleryShell({
  children,
  label,
  controls,
  height = 360,
  style,
}: {
  children: ReactNode
  label: string
  controls?: ReactNode
  height?: number
  style?: CSSProperties
}) {
  return (
    <div
      style={{
        borderRadius: 8,
        marginBottom: '1.5rem',
        background: '#0a0f1e',
        overflow: 'hidden',
        position: 'relative',
        ...style,
      }}
      aria-label={label}
    >
      <div style={{ width: '100%', height, minHeight: 280 }}>{children}</div>
      {controls ? (
        <div
          style={{
            position: 'absolute',
            bottom: 12,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: 8,
            zIndex: 2,
          }}
        >
          {controls}
        </div>
      ) : null}
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
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        background: 'rgba(255,255,255,0.12)',
        border: '1px solid rgba(255,255,255,0.25)',
        color: '#e8eaf6',
        borderRadius: 4,
        padding: '0.35rem 0.75rem',
        fontSize: '0.8rem',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  )
}
