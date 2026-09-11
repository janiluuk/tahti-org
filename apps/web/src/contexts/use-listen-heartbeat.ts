'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>
import { resolveClientApiUrl } from '@/lib/api-url'

import { useEffect, useRef } from 'react'

import type { PlayerTrack } from './player-types'
import { HEARTBEAT_INTERVAL_SEC, classifyListenSource } from './player-utils'

const API_URL = resolveClientApiUrl()

/** Listen-count + session-heartbeat side effects for the shared player.
 *
 * - Counts a "listen" toward top-lists once a sound track has played long enough
 *   to be a real listen (30s, or halfway through a shorter track) — fires at most
 *   once per track per session; the API dedupes per listener/day too.
 *
 * - While actively playing, pings "still listening" on a fixed interval — no
 *   duration self-reported, the server tracks sessions (start/last-seen/end) and
 *   closes ones that stop pinging. Skips 'live' tracks with no channelSlug
 *   (artist-only preview surfaces like the broadcast studio or green room). */
export function useListenHeartbeat(opts: {
  track: PlayerTrack | null
  playing: boolean
  currentTime: number
  duration: number
  pathname: string | null
}) {
  const { track, playing, currentTime, duration, pathname } = opts
  /** Sound track ids a listen-event has already been recorded for this session,
   * so the threshold check only ever fires once per track. */
  const recordedListenRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!track || track.kind !== 'sound') return
    if (recordedListenRef.current.has(track.id)) return
    const threshold = duration > 0 ? Math.min(30, duration * 0.5) : 30
    if (currentTime < threshold) return
    recordedListenRef.current.add(track.id)
    fetch(`${API_URL}/api/listen-events`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ soundId: track.id }),
    }).catch(() => undefined)
  }, [track, currentTime, duration])

  useEffect(() => {
    if (!track || !playing) return
    if (track.kind === 'live' && !track.channelSlug) return

    const source = classifyListenSource(pathname)
    const ping = () => {
      const body: Record<string, unknown> = { source }
      if (track.kind === 'sound') body.soundId = track.id
      else body.channelSlug = track.channelSlug
      fetch(`${API_URL}/api/v1/listen/heartbeat`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).catch(() => undefined)
    }

    ping()
    const interval = window.setInterval(ping, HEARTBEAT_INTERVAL_SEC * 1000)
    return () => window.clearInterval(interval)
  }, [track, playing, pathname])
}
