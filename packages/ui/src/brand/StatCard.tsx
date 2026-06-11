// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import React from 'react'
import { cn } from '../lib/cn'
import type { StatVariant } from '../tokens'

export type StatCardLayout = 'card' | 'inline'

export interface StatCardProps {
  /** Semantic metric type — maps to stat color tokens. */
  variant: StatVariant
  value: string
  label: string
  /** Secondary line under the value (e.g. transparency “months finalized”). */
  subtitle?: string
  /** Highlights the value in green (finance summaries). */
  positive?: boolean
  /** `card` = bordered tile; `inline` = compact row strip (homepage platform stats). */
  layout?: StatCardLayout
  className?: string
}

/** v8 metric tile — one variant per stat meaning. */
export function StatCard({
  variant,
  value,
  label,
  subtitle,
  positive,
  layout = 'card',
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        'stat-card',
        `stat-card--${variant}`,
        layout === 'inline' && 'stat-card--inline',
        positive && 'stat-card--positive',
        className,
      )}
      data-stat-variant={variant}
      role="group"
      aria-label={label}
    >
      <div className="stat-card__value">{value}</div>
      <div className="stat-card__label">{label}</div>
      {subtitle ? <div className="stat-card__subtitle">{subtitle}</div> : null}
    </div>
  )
}

export interface StatCardGridProps {
  children: React.ReactNode
  cols?: 2 | 3 | 4
  className?: string
  'aria-label'?: string
}

export function StatCardGrid({
  children,
  cols = 4,
  className,
  'aria-label': ariaLabel,
}: StatCardGridProps) {
  return (
    <div
      className={cn('stat-card-grid', `stat-card-grid--cols-${cols}`, className)}
      aria-label={ariaLabel}
      role={ariaLabel ? 'group' : undefined}
    >
      {children}
    </div>
  )
}

export interface StatCardStripProps {
  children: React.ReactNode
  className?: string
  'aria-label'?: string
}

/** Horizontal platform stats row with separators (homepage). */
export function StatCardStrip({
  children,
  className,
  'aria-label': ariaLabel,
}: StatCardStripProps) {
  const items = React.Children.toArray(children)

  return (
    <section className={cn('stat-card-strip', className)} aria-label={ariaLabel}>
      {items.map((child, index) => (
        <React.Fragment key={index}>
          {index > 0 ? <div className="stat-card-strip__sep" aria-hidden /> : null}
          {child}
        </React.Fragment>
      ))}
    </section>
  )
}
