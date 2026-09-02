// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { createContext, useContext, useEffect } from 'react'

export type StudioLayoutContextValue = {
  sidebarCollapsed: boolean
  setSidebarCollapsed: (value: boolean) => void
}

export const StudioLayoutContext = createContext<StudioLayoutContextValue | null>(null)

/** Collapses the studio sidebar to an icon rail for as long as the calling page is mounted,
 * restoring whatever state it was in before (open or already collapsed) on unmount. Used by
 * full-screen editor surfaces (Channel Designer, Audio editor) that need the reclaimed width. */
export function useAutoCollapseSidebar(): void {
  const ctx = useContext(StudioLayoutContext)
  useEffect(() => {
    if (!ctx) return
    const prior = ctx.sidebarCollapsed
    ctx.setSidebarCollapsed(true)
    return () => ctx.setSidebarCollapsed(prior)
  }, [])
}
