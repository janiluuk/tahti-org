// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { usePathname } from 'next/navigation'
import { BgCanvas } from './ui/bg-canvas'
import { usePlayer } from '@/contexts/player-context'

/** Every top-level public route that renders the shared gateway background —
 * kept in one place, one persistent <BgCanvas>, instead of each route's own
 * layout mounting/unmounting (and reinitializing WebGL) on every navigation
 * between them, which is what actually caused the visible "flick". */
const PUBLIC_NAV_PATHS = new Set(['/', '/listen', '/radio', '/venues'])

export function PublicNavBg() {
  const pathname = usePathname()
  const { analyser } = usePlayer()

  if (!pathname || !PUBLIC_NAV_PATHS.has(pathname)) return null

  return (
    <div data-tahti-ui="brand" style={{ display: 'contents' }}>
      <BgCanvas variant="subtle" analyser={pathname === '/radio' ? analyser : null} />
    </div>
  )
}
