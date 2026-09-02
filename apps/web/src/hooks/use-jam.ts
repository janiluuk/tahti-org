// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useRef, useState } from 'react'
import type { PlayerContextValue } from '@/contexts/player-context'
import { fetchJam, pushJamState, subscribeToJamEvents, type JamSession } from '@/lib/jam-client'

export type JamConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'failed'

/** Guest (and host, for its own mirror) side: loads the session, then keeps
 * it live over SSE. `ended` flips once the host closes the jam — the caller
 * decides what to show (this hook doesn't navigate away on its own). */
export function useJamState(sessionId: string | null): {
  session: JamSession | null
  connectionStatus: JamConnectionStatus
  ended: boolean
} {
  const [session, setSession] = useState<JamSession | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<JamConnectionStatus>('connecting')
  const [ended, setEnded] = useState(false)

  useEffect(() => {
    if (!sessionId) return
    let cancelled = false
    setConnectionStatus('connecting')
    setEnded(false)

    void fetchJam(sessionId)
      .then((initial) => {
        if (!cancelled) setSession(initial)
      })
      .catch(() => {
        if (!cancelled) setConnectionStatus('failed')
      })

    const unsubscribe = subscribeToJamEvents(sessionId, {
      onOpen: () => {
        if (!cancelled) setConnectionStatus('connected')
      },
      onError: () => {
        if (!cancelled) setConnectionStatus('reconnecting')
      },
      onEvent: (event) => {
        if (cancelled) return
        if (event.type === 'state') {
          setSession(event.session)
          setConnectionStatus('connected')
        } else {
          setEnded(true)
        }
      },
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [sessionId])

  return { session, connectionStatus, ended }
}

const HOST_PUSH_INTERVAL_MS = 5000

/** Host side: while `active`, mirrors this device's own player into the jam
 * session every few seconds and on every play/pause/track change. No-ops
 * when `active` is false. */
export function useJamHostSync(
  sessionId: string | null,
  active: boolean,
  player: Pick<PlayerContextValue, 'track' | 'playing' | 'currentTime'>,
): void {
  const lastSentRef = useRef<string>('')
  const { track, playing, currentTime } = player

  useEffect(() => {
    if (!sessionId || !active) return

    const push = () => {
      const currentTrack = track
        ? {
            id: track.id,
            title: track.title,
            artistName: track.subtitle ?? '',
            coverUrl: track.artworkUrl ?? null,
            // Embed-only tracks have nothing a guest's own player can stream —
            // leave streamUrl null so a guest sees "now playing" without
            // trying to auto-play them.
            streamUrl: track.embed ? null : track.url,
            protocol: track.embed
              ? null
              : (track.url.split(/[#?]/)[0]?.toLowerCase().endsWith('.m3u8') ?? false)
                ? ('hls' as const)
                : ('https' as const),
            channelSlug: track.channelSlug ?? null,
            durationSec: track.durationSec ?? null,
          }
        : null
      const body = { isPlaying: playing, currentTrack, positionSec: currentTime }
      // Position ticks constantly; only worth a request when something a
      // guest would actually notice changed (track/play-state), plus the
      // regular interval below for position drift.
      const signature = `${body.isPlaying}:${body.currentTrack?.id ?? ''}`
      if (signature === lastSentRef.current) return
      lastSentRef.current = signature
      void pushJamState(sessionId, body).catch(() => {
        // Transient failure — the next interval tick or state change retries.
      })
    }

    push()
    const interval = setInterval(() => {
      lastSentRef.current = '' // force-send on the regular tick too, for position drift
      push()
    }, HOST_PUSH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [sessionId, active, track, playing, currentTime])
}

const GUEST_DRIFT_THRESHOLD_SEC = 3
const GUEST_DRIFT_CHECK_INTERVAL_MS = 5000

function estimatedPositionSec(session: JamSession): number {
  if (!session.isPlaying) return session.positionSec
  const elapsedSec = (Date.now() - new Date(session.positionUpdatedAt).getTime()) / 1000
  return session.positionSec + Math.max(0, elapsedSec)
}

/** Guest side: while `enabled`, drives this device's own player to match
 * the jam's host-reported state — same track, same play/pause, same
 * position (periodically drift-corrected). Browsers block unattended
 * `audio.play()`, so the caller must only pass `enabled: true` after a
 * genuine user gesture (see the "Play along" button). */
export function useJamGuestPlayback(
  session: JamSession | null,
  enabled: boolean,
  player: Pick<
    PlayerContextValue,
    'load' | 'seek' | 'togglePlay' | 'playing' | 'track' | 'duration' | 'currentTime'
  >,
): void {
  const { load, seek, togglePlay, playing, track: loadedTrack, duration, currentTime } = player
  const loadedTrackIdRef = useRef<string | null>(null)

  const track = session?.currentTrack ?? null
  const trackId = track?.id ?? null
  const isPlaying = session?.isPlaying ?? false

  useEffect(() => {
    if (!enabled || !session || !track || !track.streamUrl) return
    if (loadedTrackIdRef.current !== track.id) {
      loadedTrackIdRef.current = track.id
      load(
        {
          id: track.id,
          kind: 'archive',
          url: track.streamUrl,
          title: track.title,
          subtitle: track.artistName,
          artworkUrl: track.coverUrl,
          durationSec: track.durationSec ?? undefined,
          channelSlug: track.channelSlug ?? undefined,
        },
        { autoplay: isPlaying },
      )
      // seek() takes a 0-1 ratio, resolved once duration is known below.
    } else if (playing !== isPlaying) {
      void togglePlay()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, trackId, isPlaying])

  // Seeks to the host's estimated position once the newly-loaded track
  // reports a real duration (seek() is ratio-based, so 0 duration is unusable).
  useEffect(() => {
    if (!enabled || !session || !track || loadedTrack?.id !== track.id) return
    if (duration <= 0) return
    const estimated = estimatedPositionSec(session)
    seek(Math.min(1, Math.max(0, estimated / duration)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, trackId, loadedTrack?.id, duration > 0])

  const currentTimeRef = useRef(currentTime)
  currentTimeRef.current = currentTime

  useEffect(() => {
    if (!enabled || !session || !isPlaying || !track?.streamUrl || duration <= 0) return
    const interval = setInterval(() => {
      const estimated = estimatedPositionSec(session)
      if (Math.abs(currentTimeRef.current - estimated) > GUEST_DRIFT_THRESHOLD_SEC) {
        seek(Math.min(1, Math.max(0, estimated / duration)))
      }
    }, GUEST_DRIFT_CHECK_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [enabled, session, isPlaying, track, duration, seek])
}
