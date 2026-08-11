'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useEffect, useMemo, useRef, useState } from 'react'
import { TAHTI_RADIO_SLUG, resolveColorScheme, type VisualPresetSettings } from '@tahti/shared'
import { cn, WAVEFORM_TRACK_IN_MS, WAVEFORM_TRACK_OUT_MS } from '@tahti/ui'
import HlsPlayer from '../c/[slug]/hls-player'
import ReactionsOverlay from '../c/[slug]/reactions'
import { ChannelVisualizer } from '@/components/visuals/channel-visualizer'
import { usePlayer } from '@/contexts/player-context'
import { useSuspendBackgroundCanvas } from '@/contexts/background-canvas-context'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001'
// Module-level (not a literal in JSX props) so the reference stays stable across
// this page's frequent re-renders (1s live-elapsed tick, 8s now-playing poll) —
// see ChannelVisualizer's memo() comment for why a fresh object there would
// defeat it. Pushed past the schema's un-clamped default (1) since this is the
// flagship 24/7 station and should read as visibly more alive than a typical
// channel's own visualizer.
const RADIO_VIZ_SETTINGS: VisualPresetSettings = { speed: 1.15, intensity: 1.8 }
const NOW_PLAYING_POLL_MS = 8_000

interface RadioLiveSlot {
  startAt: string
  artist: {
    displayName: string
    avatarUrl: string | null
  }
}

interface RadioNowPlayingTrack {
  title: string
  artistName: string
  artistUsername: string | null
  artworkUrl: string | null
}

interface RadioPlayerSectionProps {
  playback: { kind: 'audio'; audioUrl: string }
  slug: string
  /** The currently-active booked slot, if any — gates elapsed time + real artist
   * artwork/title. Continuous rotation playback (no live artist) passes null. */
  liveSlot: RadioLiveSlot | null
  /** STREAM-012: the orchestrator's synced rotation track, when fresh. Only used
   * while there's no liveSlot — a real booking always takes precedence. */
  nowPlaying: RadioNowPlayingTrack | null
  colorSchemeJson?: string | null
}

type BackdropPhase = 'idle' | 'out' | 'in'

/** Ticks once a second so the live-show elapsed time stays live without polling. */
function useLiveElapsedSec(startAt: string | null): number | undefined {
  const [elapsed, setElapsed] = useState<number>()

  useEffect(() => {
    if (!startAt) {
      setElapsed(undefined)
      return
    }
    const startMs = new Date(startAt).getTime()
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - startMs) / 1000)))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [startAt])

  return elapsed
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function sameNowPlaying(a: RadioNowPlayingTrack | null, b: RadioNowPlayingTrack | null): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return (
    a.title === b.title &&
    a.artistName === b.artistName &&
    a.artistUsername === b.artistUsername &&
    a.artworkUrl === b.artworkUrl
  )
}

export function RadioPlayerSection({
  playback,
  slug,
  liveSlot,
  nowPlaying: initialNowPlaying,
  colorSchemeJson,
}: RadioPlayerSectionProps) {
  const { analyser, track, updateTrackMeta } = usePlayer()
  // This card always renders its own ChannelVisualizer below (unconditionally,
  // unlike ChannelPageVisualizer) — pause the shared background canvas for as
  // long as this section is mounted so the radio page isn't running two full
  // WebGL scenes (BgCanvas + this REACTIVE_GRID) at once, one almost entirely
  // hidden behind the other.
  useSuspendBackgroundCanvas(true)
  const liveElapsedSec = useLiveElapsedSec(liveSlot?.startAt ?? null)
  const [nowPlaying, setNowPlaying] = useState(initialNowPlaying)

  useEffect(() => {
    setNowPlaying(initialNowPlaying)
  }, [initialNowPlaying])

  // Poll rotation now-playing so track handoffs animate without a full page refresh.
  useEffect(() => {
    if (liveSlot) return
    let cancelled = false

    async function refresh() {
      try {
        const res = await fetch(`${API_BASE}/api/channels/${TAHTI_RADIO_SLUG}`, {
          credentials: 'include',
          cache: 'no-store',
        })
        if (!res.ok || cancelled) return
        const data = (await res.json()) as { nowPlaying: RadioNowPlayingTrack | null }
        // Every poll parses a brand-new object even when nothing actually
        // changed — radio plays 24/7, so this fires forever, and setting
        // state unconditionally forced a re-render of the whole card (and
        // the WebGL visualizer beneath it) every 8s indefinitely. Keep the
        // old object identity when the track is unchanged so React bails
        // out of re-rendering this subtree.
        if (!cancelled) {
          setNowPlaying((prev) => (sameNowPlaying(prev, data.nowPlaying) ? prev : data.nowPlaying))
        }
      } catch {
        /* keep last known */
      }
    }

    const id = window.setInterval(() => void refresh(), NOW_PLAYING_POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [liveSlot])

  const title = liveSlot ? liveSlot.artist.displayName : (nowPlaying?.title ?? 'Tahti Radio')
  const subtitle = liveSlot
    ? 'Live now on Tahti Radio'
    : (nowPlaying?.artistName ?? 'Tahti Radio · 24/7 rotation')
  const subtitleHref =
    !liveSlot && nowPlaying?.artistUsername ? `/u/${nowPlaying.artistUsername}` : undefined
  const artworkUrl = liveSlot ? liveSlot.artist.avatarUrl : (nowPlaying?.artworkUrl ?? null)

  // liveElapsedSec ticks every second during a booked live slot — memoize so
  // that tick doesn't recompute/reallocate the color scheme on every render.
  const scheme = useMemo(() => resolveColorScheme(colorSchemeJson, null), [colorSchemeJson])
  const hasArt = Boolean(artworkUrl)

  const [backdropPhase, setBackdropPhase] = useState<BackdropPhase>('idle')
  const [displayedArt, setDisplayedArt] = useState<string | null>(artworkUrl ?? null)
  const [outgoingArt, setOutgoingArt] = useState<string | null>(null)
  const backdropBootstrapped = useRef(false)
  const backdropTimers = useRef<number[]>([])
  const displayedArtRef = useRef(displayedArt)
  displayedArtRef.current = displayedArt

  function clearBackdropTimers() {
    for (const id of backdropTimers.current) window.clearTimeout(id)
    backdropTimers.current = []
  }

  useEffect(() => {
    const incoming = artworkUrl ?? null
    if (!hasArt) {
      setDisplayedArt(incoming)
      setBackdropPhase('idle')
      setOutgoingArt(null)
      return
    }

    if (!backdropBootstrapped.current) {
      backdropBootstrapped.current = true
      setDisplayedArt(incoming)
      return
    }

    const current = displayedArtRef.current
    if (current === incoming) return

    if (prefersReducedMotion()) {
      setDisplayedArt(incoming)
      setBackdropPhase('idle')
      setOutgoingArt(null)
      return
    }

    clearBackdropTimers()
    setOutgoingArt(current)
    setBackdropPhase('out')

    const outTimer = window.setTimeout(() => {
      setDisplayedArt(incoming)
      setBackdropPhase('in')
      const inTimer = window.setTimeout(() => {
        setBackdropPhase('idle')
        setOutgoingArt(null)
      }, WAVEFORM_TRACK_IN_MS)
      backdropTimers.current.push(inTimer)
    }, WAVEFORM_TRACK_OUT_MS)
    backdropTimers.current.push(outTimer)

    return () => clearBackdropTimers()
  }, [artworkUrl, hasArt])

  const backdropUrl =
    backdropPhase === 'out' && outgoingArt ? outgoingArt : (displayedArt ?? artworkUrl)

  // Keep the shared mini-player in sync when the rotation track changes (same HLS URL).
  useEffect(() => {
    if (liveSlot) return
    if (!track || track.id !== playback.audioUrl) return
    updateTrackMeta({
      title,
      subtitle,
      artworkUrl,
      href: '/radio',
    })
  }, [liveSlot, track, playback.audioUrl, title, subtitle, artworkUrl, updateTrackMeta])

  return (
    <div
      id="live-player"
      className={cn('ch-player-wrap ch-radio-player-wrap', hasArt && 'ch-player-wrap--has-art')}
      style={
        {
          '--ch-player-art': backdropUrl ? `url(${backdropUrl})` : undefined,
          '--ch-player-overlay-tint': scheme.bg,
          '--ch-player-overlay-accent': scheme.accent,
        } as React.CSSProperties
      }
    >
      {hasArt && (
        <div
          className={cn(
            'ch-player-art-backdrop',
            backdropPhase === 'out' && 'ch-player-art-backdrop--out',
            backdropPhase === 'in' && 'ch-player-art-backdrop--in',
          )}
          aria-hidden
        />
      )}
      <div className="ch-player-inner">
        <ChannelVisualizer
          preset="REACTIVE_GRID"
          analyser={analyser}
          colorSchemeJson={colorSchemeJson}
          settings={RADIO_VIZ_SETTINGS}
          className="ch-radio-player-viz"
        />
        <HlsPlayer
          url={playback.audioUrl}
          title={title}
          subtitle={subtitle}
          subtitleHref={subtitleHref}
          artworkUrl={artworkUrl}
          liveElapsedSec={liveElapsedSec}
          isReplay={!liveSlot}
          // "/" not "/radio" — this player only ever renders already on the
          // radio.tahti.live subdomain (middleware rewrites its root to this
          // same page), so linking to the literal /radio path is a real,
          // different URL to Next.js and shows a redundant /radio suffix in
          // the address bar after clicking, even though the content is
          // identical. The shared mini-player's own href (set via
          // updateTrackMeta below) stays "/radio" — that one can be clicked
          // from any other subdomain, where a bare "/" would go to the
          // wrong (current) site's home instead of the radio station.
          href="/"
          hideWaveform
          artOverlayPlay
          animateTrackChange
          hideArtBackdrop={hasArt}
        />
      </div>
      <ReactionsOverlay slug={slug} />
    </div>
  )
}
