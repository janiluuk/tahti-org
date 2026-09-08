// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useRef, useState } from 'react'
import {
  resolveColorScheme,
  resolveVisualPresetSettings,
  parseVisualSettingsMap,
  type VisualPreset,
} from '@tahti/shared'
import { cn, WAVEFORM_TRACK_IN_MS, WAVEFORM_TRACK_OUT_MS } from '@tahti/ui'
import HlsPlayer from './hls-player'
import ReactionsOverlay from './reactions'
import { ChannelVisualizer } from '@/components/visuals/channel-visualizer'
import { resolveActiveTrackPreset } from '@/components/active-track-stage'
import { usePlayer } from '@/contexts/player-context'
import { resolveChannelUrl } from '@/lib/app-url'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001'
const NOW_PLAYING_POLL_MS = 8_000

interface NowPlayingTrack {
  title: string
  artistName: string
  artistUsername: string | null
  artworkUrl: string | null
}

type BackdropPhase = 'idle' | 'out' | 'in'

interface LivePlayerSectionProps {
  url: string
  slug: string
  title?: string
  subtitle?: string
  subtitleHref?: string
  artworkUrl?: string | null
  isReplay?: boolean
  nextUpLabel?: string
  /** Curated rotation (Tahti Radio / Selects) — animate title handoffs + viz. */
  isRotationChannel?: boolean
  /** Poll `/api/channels/:slug` for now-playing metadata (rotation or any stream with titles). */
  pollNowPlaying?: boolean
  colorSchemeJson?: string | null
  visualPreset?: VisualPreset
  visualSettingsJson?: string | null
  initialNowPlaying?: NowPlayingTrack | null
  initialNowPlayingNext?: { title: string; artistName: string } | null
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function LivePlayerSection({
  url,
  slug,
  title: initialTitle,
  subtitle: initialSubtitle,
  subtitleHref: initialSubtitleHref,
  artworkUrl: initialArtworkUrl,
  isReplay = false,
  nextUpLabel: initialNextUpLabel,
  isRotationChannel = false,
  pollNowPlaying = false,
  colorSchemeJson,
  visualPreset = 'MINIMAL',
  visualSettingsJson,
  initialNowPlaying = null,
  initialNowPlayingNext = null,
}: LivePlayerSectionProps) {
  const { analyser, track, updateTrackMeta } = usePlayer()
  const [nowPlaying, setNowPlaying] = useState(initialNowPlaying)
  const [nextUp, setNextUp] = useState(initialNowPlayingNext)
  const shouldPoll = pollNowPlaying || isRotationChannel

  const title = shouldPoll ? (nowPlaying?.title ?? initialTitle) : initialTitle
  const subtitle = shouldPoll ? (nowPlaying?.artistName ?? initialSubtitle) : initialSubtitle
  const subtitleHref =
    shouldPoll && nowPlaying?.artistUsername
      ? `/u/${nowPlaying.artistUsername}`
      : initialSubtitleHref
  const artworkUrl = shouldPoll ? (nowPlaying?.artworkUrl ?? initialArtworkUrl) : initialArtworkUrl
  const nextUpLabel =
    shouldPoll && nextUp ? `${nextUp.title} — ${nextUp.artistName}` : initialNextUpLabel

  useEffect(() => {
    setNowPlaying(initialNowPlaying)
  }, [initialNowPlaying])

  useEffect(() => {
    setNextUp(initialNowPlayingNext)
  }, [initialNowPlayingNext])

  useEffect(() => {
    if (!shouldPoll) return
    let cancelled = false

    async function refresh() {
      try {
        const res = await fetch(`${API_BASE}/api/channels/${slug}`, {
          credentials: 'include',
          cache: 'no-store',
        })
        if (!res.ok || cancelled) return
        const data = (await res.json()) as {
          nowPlaying: NowPlayingTrack | null
          nowPlayingNext: { title: string; artistName: string } | null
        }
        if (cancelled) return
        setNowPlaying(data.nowPlaying)
        setNextUp(data.nowPlayingNext)
      } catch {
        /* keep last known */
      }
    }

    const id = window.setInterval(() => void refresh(), NOW_PLAYING_POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [shouldPoll, slug])

  useEffect(() => {
    if (!shouldPoll) return
    if (!track || track.id !== url) return
    updateTrackMeta({
      title: title ?? 'Live stream',
      subtitle,
      artworkUrl,
      href: resolveChannelUrl(slug),
    })
  }, [shouldPoll, track, url, title, subtitle, artworkUrl, slug, updateTrackMeta])

  const scheme = resolveColorScheme(colorSchemeJson, null)
  const hasArt = Boolean(artworkUrl)
  const resolvedPreset = resolveActiveTrackPreset(visualPreset)
  const showViz = isRotationChannel && resolvedPreset !== 'MINIMAL'

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
    if (!hasArt || !shouldPoll) {
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
  }, [artworkUrl, hasArt, shouldPoll])

  const backdropUrl =
    backdropPhase === 'out' && outgoingArt ? outgoingArt : (displayedArt ?? artworkUrl)

  return (
    <div
      id="live-player"
      className={cn('ch-player-wrap', hasArt && 'ch-player-wrap--has-art ch-channel-player-wrap')}
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
        {showViz && (
          <ChannelVisualizer
            preset={resolvedPreset}
            colorSchemeJson={colorSchemeJson}
            settings={resolveVisualPresetSettings(
              parseVisualSettingsMap(visualSettingsJson),
              visualPreset,
            )}
            analyser={analyser}
            className="ch-channel-player-viz"
          />
        )}
        <HlsPlayer
          url={url}
          title={title}
          subtitle={subtitle ?? `@${slug}`}
          subtitleHref={subtitleHref}
          href={resolveChannelUrl(slug)}
          channelSlug={slug}
          artworkUrl={artworkUrl}
          isReplay={isReplay}
          nextUpLabel={nextUpLabel}
          hideWaveform={showViz}
          animateTrackChange={shouldPoll}
          hideArtBackdrop={hasArt}
        />
      </div>
      <ReactionsOverlay slug={slug} />
    </div>
  )
}
