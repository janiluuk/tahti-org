// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import React from 'react'

type Accent = 'amber' | 'cyan' | 'green' | 'purple' | 'coral' | 'lavender'

export interface CardProps {
  accent?: Accent
  icon?: React.ReactNode
  tag?: string
  title?: string
  titleAccent?: Accent
  children?: React.ReactNode
  className?: string
  footer?: React.ReactNode
}

export function Card({
  accent = 'amber',
  icon,
  tag,
  title,
  titleAccent,
  children,
  className = '',
  footer,
}: CardProps) {
  return (
    <div className={`card ${accent} ${className}`.trim()}>
      {icon && <div className="card-icon">{icon}</div>}
      {tag && <div className="card-tag">{tag}</div>}
      {title && <h3 className={titleAccent ?? accent}>{title}</h3>}
      {children && <p>{children}</p>}
      {footer}
    </div>
  )
}

export interface ToolCardProps {
  icon: React.ReactNode
  title: string
  subtitle: string
  accent?: Accent
  className?: string
}

export function ToolCard({
  icon,
  title,
  subtitle,
  accent = 'cyan',
  className = '',
}: ToolCardProps) {
  return (
    <div className={`tool-card ${className}`} style={{ borderLeftColor: `var(--${accent})` }}>
      <div className="tool-icon">{icon}</div>
      <div>
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </div>
    </div>
  )
}
