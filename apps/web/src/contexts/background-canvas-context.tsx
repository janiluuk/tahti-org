'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

interface BackgroundCanvasContextValue {
  /** True while something is covering the shared background canvas (BgCanvas)
   * and it should pause its render loop instead of animating a full WebGL
   * scene nobody can see. */
  suspended: boolean
  /** Marks the background as covered for as long as the caller wants — call
   * again (idempotent) or release via the returned function. Reference-
   * counted so more than one covering visualizer can't fight over it. */
  suspend: () => () => void
}

const BackgroundCanvasContext = createContext<BackgroundCanvasContextValue | null>(null)

export function BackgroundCanvasProvider({ children }: { children: ReactNode }) {
  const [suspended, setSuspended] = useState(false)
  const countRef = useRef(0)

  const suspend = useCallback(() => {
    countRef.current += 1
    setSuspended(true)
    let released = false
    return () => {
      if (released) return
      released = true
      countRef.current = Math.max(0, countRef.current - 1)
      if (countRef.current === 0) setSuspended(false)
    }
  }, [])

  return (
    <BackgroundCanvasContext.Provider value={{ suspended, suspend }}>
      {children}
    </BackgroundCanvasContext.Provider>
  )
}

function useBackgroundCanvas(): BackgroundCanvasContextValue {
  const ctx = useContext(BackgroundCanvasContext)
  if (!ctx) {
    throw new Error('useBackgroundCanvas must be used within a BackgroundCanvasProvider')
  }
  return ctx
}

/** Call from a page-level visualizer that fully covers the shared background
 * canvas (e.g. ChannelPageVisualizer whenever it's rendering a non-MINIMAL
 * preset) — pauses BgCanvas's render loop for as long as `active` stays true,
 * so the page isn't paying for two full WebGL scenes animating at once when
 * only one is ever visible. */
export function useSuspendBackgroundCanvas(active: boolean): void {
  const { suspend } = useBackgroundCanvas()
  useEffect(() => {
    if (!active) return
    return suspend()
  }, [active, suspend])
}

/** Read by BgCanvas itself to know whether to skip its per-frame work. */
export function useBackgroundCanvasSuspended(): boolean {
  return useBackgroundCanvas().suspended
}
