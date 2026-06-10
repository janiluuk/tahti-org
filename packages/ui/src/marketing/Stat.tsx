// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import React from 'react'

type Accent = 'amber' | 'cyan' | 'green' | 'lavender'

interface StatProps {
  value: string
  label: string
  accent?: Accent
}

/**
 * @deprecated Prefer {@link StatCard} with `variant` for semantic stat colors (v8).
 */
export function Stat({ value, label, accent = 'amber' }: StatProps) {
  return (
    <div className="stat">
      <div className={`stat-value ${accent !== 'amber' ? accent : ''}`}>{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  )
}

interface StatGridProps {
  children: React.ReactNode
  cols?: 2 | 3 | 4
}
export function StatGrid({ children, cols = 4 }: StatGridProps) {
  return <div className={`grid-${cols}`}>{children}</div>
}
