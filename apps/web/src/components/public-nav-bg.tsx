// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { BgCanvas } from './ui/bg-canvas'
import { usePlayer } from '@/contexts/player-context'

/** Single persistent gateway background — mounted once here, unconditionally, so
 * every route (public marketing pages, auth, channel/profile, the artist panel,
 * admin) shares the exact same animated canvas instead of each section either
 * mounting its own local <BgCanvas> (which reinitializes WebGL and reshuffles
 * particle positions on every navigation — the visible "different per section"
 * flicker) or falling back to an unrelated CSS-only gradient wash. Never remounts
 * across client-side navigation, including through login, so both this animation
 * and (via the shared PlayerProvider) playback stay uninterrupted while moving
 * between sections. Reacts to the shared analyser whenever something is playing,
 * from whichever section started it. */
export function PublicNavBg() {
  const { analyser } = usePlayer()

  return (
    <div data-tahti-ui="brand" style={{ display: 'contents' }}>
      <BgCanvas variant="subtle" analyser={analyser} />
      <div className="app-bg-veil" aria-hidden />
    </div>
  )
}
