'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useState, type ReactNode } from 'react'
import { cn } from '../lib/cn'

export type StudioCollapseProps = {
  title: ReactNode
  hint?: ReactNode
  defaultOpen?: boolean
  children: ReactNode
  className?: string
}

/** Collapsible section for dense studio dashboards (native details/summary). */
export function StudioCollapse({
  title,
  hint,
  defaultOpen,
  children,
  className,
}: StudioCollapseProps) {
  const [open, setOpen] = useState(Boolean(defaultOpen))

  return (
    <details
      className={cn('studio-collapse', className)}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="studio-collapse__summary">
        <span className="studio-collapse__title">{title}</span>
        {hint ? <span className="studio-collapse__hint">{hint}</span> : null}
      </summary>
      <div className="studio-collapse__body">{children}</div>
    </details>
  )
}
