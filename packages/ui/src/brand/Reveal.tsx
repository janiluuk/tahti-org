'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useId, useState, type ReactNode } from 'react'

export interface RevealProps {
  /** Hidden by default, shown when expanded — the rest of a truncated post
   * body, extra images, anything beyond the always-visible teaser. */
  children: ReactNode
  expandLabel?: string
  collapseLabel?: string
  defaultOpen?: boolean
  className?: string
}

/** Progressive disclosure for a card's "read more" content — expands in
 * place instead of navigating to a modal. Pure-CSS height animation (a
 * `grid-template-rows` 0fr→1fr transition on the wrapper, content clipped
 * via `overflow: hidden` on the inner row) rather than measuring pixel
 * heights, so it needs no ResizeObserver and never mismatches on first
 * render. */
export function Reveal({
  children,
  expandLabel = 'Read more',
  collapseLabel = 'Show less',
  defaultOpen = false,
  className,
}: RevealProps) {
  const [open, setOpen] = useState(defaultOpen)
  const contentId = useId()

  return (
    <div className={`ui-reveal${className ? ` ${className}` : ''}`}>
      <div className="ui-reveal__frame" data-open={open}>
        <div className="ui-reveal__clip">
          <div id={contentId} className="ui-reveal__content">
            {children}
          </div>
        </div>
      </div>
      <button
        type="button"
        className="ui-reveal__toggle"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? collapseLabel : expandLabel}
      </button>
    </div>
  )
}
