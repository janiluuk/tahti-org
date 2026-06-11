// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import Link from 'next/link'
import { usePlayer } from '@/contexts/player-context'

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function MiniPlayer() {
  const { track, playing, buffering, currentTime, duration, togglePlay, seek, close } = usePlayer()

  if (!track) return null

  const progress = duration > 0 ? currentTime / duration : 0

  return (
    <div className="mini-player" data-testid="mini-player" role="region" aria-label="Now playing">
      {track.kind === 'archive' && duration > 0 && (
        <button
          type="button"
          className="mini-player__progress"
          aria-label="Seek"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            seek((e.clientX - rect.left) / rect.width)
          }}
        >
          <span className="mini-player__progress-fill" style={{ width: `${progress * 100}%` }} />
        </button>
      )}
      <div className="mini-player__inner">
        <button
          type="button"
          className="mini-player__play"
          onClick={() => void togglePlay()}
          aria-label={playing ? 'Pause' : 'Play'}
          disabled={buffering}
        >
          {buffering ? '…' : playing ? '❚❚' : '▶'}
        </button>
        <div className="mini-player__info">
          {track.href ? (
            <Link href={track.href} className="mini-player__title">
              {track.title}
            </Link>
          ) : (
            <span className="mini-player__title">{track.title}</span>
          )}
          {track.subtitle && <span className="mini-player__subtitle">{track.subtitle}</span>}
        </div>
        {track.kind === 'live' ? (
          <span className="mini-player__badge">LIVE</span>
        ) : (
          <span className="mini-player__time">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        )}
        <button
          type="button"
          className="mini-player__close"
          onClick={close}
          aria-label="Close player"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
