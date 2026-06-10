// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import React from 'react'
import { cn } from '../lib/cn'
import type { StatVariant } from '../tokens'

export interface StatCardProps {
  /** Semantic metric type — maps to stat color tokens (plays, downloads, fans, revenue). */
  variant: StatVariant
  value: string
  label: string
  className?: string
}

/** v8 dashboard metric tile — one variant per stat meaning. */
export function StatCard({ variant, value, label, className }: StatCardProps) {
  return (
    <div
      className={cn('stat-card', `stat-card--${variant}`, className)}
      data-stat-variant={variant}
      role="group"
      aria-label={label}
    >
      <div className="stat-card__value">{value}</div>
      <div className="stat-card__label">{label}</div>
    </div>
  )
}

export interface StatCardGridProps {
  children: React.ReactNode
  cols?: 2 | 3 | 4
  className?: string
}

export function StatCardGrid({ children, cols = 4, className }: StatCardGridProps) {
  return (
    <div className={cn('stat-card-grid', `stat-card-grid--cols-${cols}`, className)}>
      {children}
    </div>
  )
}
