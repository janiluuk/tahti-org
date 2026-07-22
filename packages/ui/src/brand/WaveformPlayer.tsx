'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import React, { useCallback } from 'react'
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

  return (
    <div
      className={cn('waveform-player', embedded && 'waveform-player--embedded', className)}
      style={
        artworkUrl
          ? ({ '--waveform-player-art': `url(${artworkUrl})` } as React.CSSProperties)
          : undefined
      }
    >
      {artworkUrl && <div className="waveform-player__art-backdrop" aria-hidden />}
      {nowPlayingTitle && (
        <div className="waveform-player__meta">
          {artworkUrl ? (
            <img src={artworkUrl} alt="" className="waveform-player__art" />
          ) : (
            <AvatarTile size="lg" name={nowPlayingTitle} className="waveform-player__art" />
          )}
          <div className="waveform-player__meta-text">
            <span className="waveform-player__meta-title">{nowPlayingTitle}</span>
            {nowPlayingSubtitle &&
              (nowPlayingSubtitleHref ? (
                <Link
                  href={nowPlayingSubtitleHref}
                  className="waveform-player__meta-subtitle waveform-player__meta-subtitle--link"
                >
                  {nowPlayingSubtitle}
                </Link>
              ) : (
                <span className="waveform-player__meta-subtitle">{nowPlayingSubtitle}</span>
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

      <div className="waveform-player__controls">
        <button
          type="button"
          className={cn('waveform-player__play', buffering && 'waveform-player__play--buffering')}
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
          <span className="waveform-player__time waveform-player__time--next-up">
            {isLive
              ? liveElapsedSec != null
                ? formatPlayerTime(liveElapsedSec)
                : isReplay
                  ? nextUpLabel
                    ? `Next: ${nextUpLabel}`
                    : 'REPLAY'
                  : 'LIVE'
              : formatPlayerTime(currentTime)}
          </span>
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
