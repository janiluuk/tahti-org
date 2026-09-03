// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from './cn'

export interface ExpandableTextProps {
  children: ReactNode
  /** Collapsed height in px before a "more…" link appears. Default 160 (~a
   * few lines of body copy) — tune per surface via this prop, not by
   * wrapping in extra CSS. */
  collapsedHeightPx?: number
  moreLabel?: string
  lessLabel?: string
  className?: string
}

/** Clamps long rendered content (a bio, a release note, any block of prose)
 * to `collapsedHeightPx` with an inline "more…" link, expanding in place —
 * no modal, no navigation. Measures actual rendered height client-side so it
 * works with any children (plain text, sanitized bio HTML, markdown output)
 * rather than an unreliable character-count guess. Renders collapsed by
 * default (matches the pre-measurement state) so there's no layout shift;
 * the "more…" link itself only appears once overflow is confirmed, so short
 * text never grows a pointless toggle. */
export function ExpandableText({
  children,
  collapsedHeightPx = 160,
  moreLabel = 'more…',
  lessLabel = 'less',
  className,
}: ExpandableTextProps) {
  const [expanded, setExpanded] = useState(false)
  const [overflowing, setOverflowing] = useState<boolean | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    setOverflowing(el.scrollHeight > collapsedHeightPx + 1)
  }, [collapsedHeightPx, children])

  const clamped = !expanded && overflowing !== false

  return (
    <div className={className}>
      <div
        ref={contentRef}
        style={clamped ? { maxHeight: collapsedHeightPx, overflow: 'hidden' } : undefined}
      >
        {children}
      </div>
      {overflowing === true && (
        <button
          type="button"
          className={cn('ui-expandable-text__toggle')}
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded ? lessLabel : moreLabel}
        </button>
      )}
    </div>
  )
}
