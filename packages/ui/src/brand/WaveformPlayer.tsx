'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import React, { useCallback } from 'react'
import { cn } from '../lib/cn'
import { formatPlayerTime, WAVEFORM_BAR_HEIGHTS } from '../lib/waveform-player'

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
}: WaveformPlayerProps) {
  const label =
    statusLabel ?? (buffering ? 'Buffering…' : playing ? 'Live stream' : 'Ready to play')

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
    <div className={cn('waveform-player', embedded && 'waveform-player--embedded', className)}>
      <div className="waveform-player__status">
        <span
          className={cn('waveform-player__dot', playing && 'waveform-player__dot--live')}
          aria-hidden
        />
        <span className="waveform-player__status-label">{label}</span>
        {formatBadge ? <span className="waveform-player__badge">{formatBadge}</span> : null}
      </div>

      <div className="waveform-player__waveform" aria-hidden="true">
        {WAVEFORM_BAR_HEIGHTS.map((h, i) => (
          <div
            key={i}
            className={cn('waveform-player__bar', playing && 'waveform-player__bar--active')}
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
            <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden>
              <rect x="3" y="2" width="4" height="14" rx="1" />
              <rect x="11" y="2" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden>
              <path d="M5 3l11 6-11 6V3z" />
            </svg>
          )}
        </button>

        <div className="waveform-player__progress-wrap">
          <span className="waveform-player__time">
            {isLive ? 'LIVE' : formatPlayerTime(currentTime)}
          </span>
          <div
            className={cn('waveform-player__progress', isLive && 'waveform-player__progress--live')}
            onClick={handleSeek}
            role={isLive ? undefined : 'slider'}
            aria-valuenow={isLive ? undefined : Math.round(progress * 100)}
            aria-valuemin={isLive ? undefined : 0}
            aria-valuemax={isLive ? undefined : 100}
            tabIndex={isLive ? undefined : 0}
          >
            <div
              className="waveform-player__progress-fill"
              style={{ width: `${progress * 100}%` }}
            />
            {!isLive && (
              <div
                className="waveform-player__progress-thumb"
                style={{ left: `${progress * 100}%` }}
              />
            )}
          </div>
          {!isLive && <span className="waveform-player__time">{formatPlayerTime(duration)}</span>}
        </div>
      </div>
    </div>
  )
}
