// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import React from 'react'

type Variant = 'amber' | 'cyan' | 'green' | 'purple'

export interface CalloutProps {
  label: string
  children: React.ReactNode
  variant?: Variant
  className?: string
}

export function Callout({ label, children, variant = 'amber', className = '' }: CalloutProps) {
  return (
    <div className={`callout ${variant !== 'amber' ? variant : ''} ${className}`.trim()}>
      <div className="callout-label">{label}</div>
      <p>{children}</p>
    </div>
  )
}
