'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import React, { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { cn } from '../lib/cn'
import { formatPlayerTime, WAVEFORM_BAR_HEIGHTS } from '../lib/waveform-player'
import { AvatarTile } from './AvatarTile'

export interface WaveformPlayerProps {
  playing?: boolean
  buffering?: boolean
  /** Live streams hide seek thumb and show LIVE instead of duration. */
  isLive?: boolean
  currentTime?: number
  duration?: number
  statusLabel?: string
  formatBadge?: string
  onTogglePlay?: () => void
  onSeek?: (ratio: number) => void
  /** Strip outer card chrome when nested inside channel player shell. */
  embedded?: boolean
  className?: string
  /** No source connected yet (e.g. broadcast test-signal step) — shows a slow amber
   * traveling-wave animation instead of the frozen idle bars, so it reads as "the
   * server is listening" rather than "nothing is happening". */
  waitingForSignal?: boolean
  /** A fatal playback error occurred for this stream — shows "Stream offline"
   * instead of silently sitting on a frozen/buffering state. */
  offline?: boolean
  /** What's currently playing — shown as a small thumbnail + title/subtitle row.
   * Omit entirely to skip rendering this row (existing callers unaffected). */
  artworkUrl?: string | null
  nowPlayingTitle?: string
  nowPlayingSubtitle?: string
  /** When set, the subtitle (artist name) becomes a link — e.g. to that
   * artist's profile, for rotation channels playing another artist's track. */
  nowPlayingSubtitleHref?: string
  /** Wall-clock seconds since a live broadcast began — shown instead of the bare
   * "LIVE" label when set. Continuous rotation playback should leave this unset,
   * since there's no meaningful "elapsed" for a shuffled, unbounded stream. */
  liveElapsedSec?: number
  /** isLive is technically true for any unseekable continuous stream, even when
   * it's actually playing a pre-recorded rotation with nobody on air — set this
   * so the label reads "REPLAY" instead of the misleading "LIVE NOW". */
  isReplay?: boolean
  /** Curated-rotation channels only: "<title> — <artist>" for what plays after
   * the current track. When set (and isReplay), replaces the bare "REPLAY"
   * label next to the play button with "Next: ...". */
  nextUpLabel?: string
  /** Skip the static CSS waveform bars — for callers that already render their
   * own audio-reactive backdrop (e.g. a ChannelVisualizer) behind this player,
   * where the static bars would be a redundant, non-reactive second animation. */
  hideWaveform?: boolean
  /** Tahti Radio only: render play/pause as a centered overlay on the artwork
   * (faded out until hovered on desktop) instead of the inline controls-row
   * button, which stays in the DOM but is visually hidden by the radio-scoped
   * CSS — kept for focus/keyboard access rather than duplicated. */
  artOverlayPlay?: boolean
  /** Animate title/artist out, backdrop fade, then fly new art + text in when
   * the now-playing identity changes (Tahti Radio track handoff). */
  animateTrackChange?: boolean
}

type TrackPhase = 'idle' | 'out' | 'in'

interface DisplayedMeta {
  title: string
  subtitle?: string
  subtitleHref?: string
  artworkUrl?: string | null
}

const OUT_MS = 380
const IN_MS = 560

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Custom HLS/archive player chrome — waveform, play/pause, seek bar. */
export function WaveformPlayer({
  playing = false,
  buffering = false,
  isLive = true,
  currentTime = 0,
  duration = 0,
  statusLabel,
  formatBadge = 'HLS',
  onTogglePlay,
  onSeek,
  embedded = false,
  className,
  waitingForSignal = false,
  offline = false,
  artworkUrl,
  nowPlayingTitle,
  nowPlayingSubtitle,
  nowPlayingSubtitleHref,
  liveElapsedSec,
  isReplay = false,
  nextUpLabel,
  hideWaveform = false,
  artOverlayPlay = false,
  animateTrackChange = false,
}: WaveformPlayerProps) {
  const label =
    statusLabel ??
    (offline
      ? 'Stream offline'
      : waitingForSignal
        ? 'Waiting for signal…'
        : buffering
          ? 'Buffering…'
          : isLive
            ? isReplay
              ? 'REPLAY'
              : 'LIVE NOW'
            : playing
              ? 'Now playing'
              : 'Ready to play')

  const progress = isLive || duration <= 0 ? 0 : Math.min(1, currentTime / duration)

  // The status pill above already says REPLAY once when isReplay && !nextUpLabel —
  // repeating the bare word here read as a glitch, so that specific case renders
  // nothing instead. Every other case still shows real, non-redundant info.
  const nextUpTimeLabel = isLive
    ? liveElapsedSec != null
      ? formatPlayerTime(liveElapsedSec)
      : isReplay
        ? nextUpLabel
          ? `Next: ${nextUpLabel}`
          : null
        : 'LIVE'
    : formatPlayerTime(currentTime)

  const handleSeek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isLive || !onSeek) return
      const bar = e.currentTarget
      const { left, width } = bar.getBoundingClientRect()
      const ratio = Math.max(0, Math.min(1, (e.clientX - left) / width))
      onSeek(ratio)
    },
    [isLive, onSeek],
  )

  const incomingTitle = nowPlayingTitle
  const incomingSubtitle = nowPlayingSubtitle
  const incomingSubtitleHref = nowPlayingSubtitleHref
  const incomingArtwork = artworkUrl ?? null

  const [displayed, setDisplayed] = useState<DisplayedMeta | null>(() =>
    incomingTitle
      ? {
          title: incomingTitle,
          subtitle: incomingSubtitle,
          subtitleHref: incomingSubtitleHref,
          artworkUrl: incomingArtwork,
        }
      : null,
  )
  const [phase, setPhase] = useState<TrackPhase>('idle')
  const [outgoingArt, setOutgoingArt] = useState<string | null>(null)
  const bootstrapped = useRef(false)
  const animTimers = useRef<number[]>([])
  const displayedRef = useRef(displayed)
  displayedRef.current = displayed

  function clearAnimTimers() {
    for (const id of animTimers.current) window.clearTimeout(id)
    animTimers.current = []
  }

  useEffect(() => {
    const incoming: DisplayedMeta | null = incomingTitle
      ? {
          title: incomingTitle,
          subtitle: incomingSubtitle,
          subtitleHref: incomingSubtitleHref,
          artworkUrl: incomingArtwork,
        }
      : null

    if (!animateTrackChange || !incoming) {
      setDisplayed(incoming)
      setPhase('idle')
      setOutgoingArt(null)
      return
    }

    if (!bootstrapped.current) {
      bootstrapped.current = true
      setDisplayed(incoming)
      return
    }

    const current = displayedRef.current
    const same =
      current?.title === incoming.title &&
      current?.subtitle === incoming.subtitle &&
      current?.artworkUrl === incoming.artworkUrl
    if (same) return

    if (prefersReducedMotion()) {
      setDisplayed(incoming)
      setPhase('idle')
      setOutgoingArt(null)
      return
    }

    clearAnimTimers()
    setOutgoingArt(current?.artworkUrl ?? null)
    setPhase('out')

    const outTimer = window.setTimeout(() => {
      setDisplayed(incoming)
      setPhase('in')
      const inTimer = window.setTimeout(() => {
        setPhase('idle')
        setOutgoingArt(null)
      }, IN_MS)
      animTimers.current.push(inTimer)
    }, OUT_MS)
    animTimers.current.push(outTimer)

    return () => clearAnimTimers()
  }, [
    animateTrackChange,
    incomingTitle,
    incomingSubtitle,
    incomingSubtitleHref,
    incomingArtwork,
  ])

  const shown = animateTrackChange
    ? displayed
    : incomingTitle
      ? {
          title: incomingTitle,
          subtitle: incomingSubtitle,
          subtitleHref: incomingSubtitleHref,
          artworkUrl: incomingArtwork,
        }
      : null
  const artUrl = shown?.artworkUrl ?? null
  const backdropUrl = phase === 'out' && outgoingArt ? outgoingArt : artUrl

  return (
    <div
      className={cn(
        'waveform-player',
        embedded && 'waveform-player--embedded',
        animateTrackChange && phase !== 'idle' && `waveform-player--track-${phase}`,
        className,
      )}
      style={
        backdropUrl
          ? ({ '--waveform-player-art': `url(${backdropUrl})` } as React.CSSProperties)
          : undefined
      }
    >
      {backdropUrl && (
        <div
          className={cn(
            'waveform-player__art-backdrop',
            phase === 'out' && 'waveform-player__art-backdrop--out',
            phase === 'in' && 'waveform-player__art-backdrop--in',
          )}
          aria-hidden
        />
      )}
      {shown?.title && (
        <div className="waveform-player__meta">
          <div
            className={cn(
              'waveform-player__art-wrap',
              phase === 'out' && 'waveform-player__art-wrap--out',
              phase === 'in' && 'waveform-player__art-wrap--in',
            )}
          >
            {artUrl ? (
              <img src={artUrl} alt="" className="waveform-player__art" />
            ) : (
              <AvatarTile size="lg" name={shown.title} className="waveform-player__art" />
            )}
            {artOverlayPlay && (
              <button
                type="button"
                className={cn(
                  'waveform-player__art-play',
                  buffering && 'waveform-player__art-play--buffering',
                )}
                onClick={onTogglePlay}
                disabled={!onTogglePlay}
                aria-label={playing ? 'Pause' : 'Play'}
              >
                {buffering ? (
                  <span className="waveform-player__spinner" aria-hidden />
                ) : playing ? (
                  <svg width="32" height="32" viewBox="0 0 18 18" fill="currentColor" aria-hidden>
                    <rect x="3" y="2" width="4" height="14" rx="1" />
                    <rect x="11" y="2" width="4" height="14" rx="1" />
                  </svg>
                ) : (
                  <svg width="32" height="32" viewBox="0 0 18 18" fill="currentColor" aria-hidden>
                    <path d="M5 3l11 6-11 6V3z" />
                  </svg>
                )}
              </button>
            )}
          </div>
          <div
            className={cn(
              'waveform-player__meta-text',
              phase === 'out' && 'waveform-player__meta-text--out',
              phase === 'in' && 'waveform-player__meta-text--in',
            )}
          >
            <span className="waveform-player__meta-title">{shown.title}</span>
            {shown.subtitle &&
              (shown.subtitleHref ? (
                <Link
                  href={shown.subtitleHref}
                  className="waveform-player__meta-subtitle waveform-player__meta-subtitle--link"
                >
                  {shown.subtitle}
                </Link>
              ) : (
                <span className="waveform-player__meta-subtitle">{shown.subtitle}</span>
              ))}
          </div>
        </div>
      )}

      <div className="waveform-player__status">
        <span
          className={cn(
            'waveform-player__dot',
            playing && 'waveform-player__dot--live',
            waitingForSignal && 'waveform-player__dot--waiting',
            offline && 'waveform-player__dot--offline',
          )}
          aria-hidden
        />
        <span className="waveform-player__status-label">{label}</span>
        {formatBadge ? <span className="waveform-player__badge">{formatBadge}</span> : null}
      </div>

      {!hideWaveform && (
        <div className="waveform-player__waveform" aria-hidden="true">
          {WAVEFORM_BAR_HEIGHTS.map((h, i) => (
            <div
              key={i}
              className={cn(
                'waveform-player__bar',
                playing && 'waveform-player__bar--active',
                waitingForSignal && 'waveform-player__bar--waiting',
              )}
              style={
                {
                  '--h': `${h}px`,
                  '--delay': `${(i * 0.05).toFixed(2)}s`,
                  '--dur': `${0.6 + (i % 7) * 0.1}s`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
      )}

      <div className="waveform-player__controls">
        <button
          type="button"
          className={cn(
            'waveform-player__play',
            buffering && 'waveform-player__play--buffering',
            artOverlayPlay && 'waveform-player__play--hidden',
          )}
          onClick={onTogglePlay}
          disabled={!onTogglePlay}
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {buffering ? (
            <span className="waveform-player__spinner" aria-hidden />
          ) : playing ? (
            <svg width="24" height="24" viewBox="0 0 18 18" fill="currentColor" aria-hidden>
              <rect x="3" y="2" width="4" height="14" rx="1" />
              <rect x="11" y="2" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 18 18" fill="currentColor" aria-hidden>
              <path d="M5 3l11 6-11 6V3z" />
            </svg>
          )}
        </button>

        <div className="waveform-player__progress-wrap">
          {nextUpTimeLabel && (
            <span className="waveform-player__time waveform-player__time--next-up">
              {nextUpTimeLabel}
            </span>
          )}
          {!isLive && (
            <>
              <div
                className="waveform-player__progress"
                onClick={handleSeek}
                role="slider"
                aria-valuenow={Math.round(progress * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                tabIndex={0}
              >
                <div
                  className="waveform-player__progress-fill"
                  style={{ width: `${progress * 100}%` }}
                />
                <div
                  className="waveform-player__progress-thumb"
                  style={{ left: `${progress * 100}%` }}
                />
              </div>
              <span className="waveform-player__time">{formatPlayerTime(duration)}</span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
