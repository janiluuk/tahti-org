// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useRef, useState } from 'react'

/** Client-side window over a full in-memory list — grows by `pageSize` as the
 * sentinel scrolls into view (Discover artist grids). */
export function useInfiniteSlice<T>(items: T[], pageSize: number, resetKey?: string) {
  const [visible, setVisible] = useState(pageSize)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setVisible(pageSize)
  }, [pageSize, resetKey])

  const hasMore = visible < items.length

  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasMore) return

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible((v) => Math.min(v + pageSize, items.length))
        }
      },
      { root: null, rootMargin: '240px 0px', threshold: 0 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [hasMore, items.length, pageSize, visible])

  return {
    shown: items.slice(0, visible),
    hasMore,
    sentinelRef,
    total: items.length,
    visibleCount: Math.min(visible, items.length),
  }
}
