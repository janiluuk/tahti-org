// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AvatarTile } from '@tahti/ui'
import { usePlayer, type PlayerTrack } from '@/contexts/player-context'

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function QueueItem({
  item,
  onPlay,
  onRemove,
}: {
  item: PlayerTrack
  onPlay: () => void
  onRemove: () => void
}) {
  return (
    <li className="mini-player-queue__item">
      <button
        type="button"
        className="mini-player-queue__item-play"
        onClick={onPlay}
        aria-label={`Play ${item.title}`}
      >
        {item.artworkUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.artworkUrl} alt="" className="mini-player-queue__art" />
        ) : (
          <AvatarTile size="xs" name={item.title} className="mini-player-queue__art" />
        )}
        <span className="mini-player-queue__meta">
          <span className="mini-player-queue__title">{item.title}</span>
          {item.subtitle && <span className="mini-player-queue__subtitle">{item.subtitle}</span>}
        </span>
      </button>
      <button
        type="button"
        className="mini-player-queue__remove"
        onClick={onRemove}
        aria-label={`Remove ${item.title} from queue`}
      >
        ✕
      </button>
    </li>
  )
}

function VolumeIcon({ muted, volume }: { muted: boolean; volume: number }) {
  if (muted || volume === 0) {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M2 6h2.5L8 3v10L4.5 10H2V6z" fill="currentColor" />
        <path
          d="M10.5 6.5l3 3m0-3l-3 3"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    )
  }
  if (volume < 0.5) {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M2 6h2.5L8 3v10L4.5 10H2V6z" fill="currentColor" />
        <path
          d="M10.8 6.3a2.6 2.6 0 0 1 0 3.4"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    )
  }
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M2 6h2.5L8 3v10L4.5 10H2V6z" fill="currentColor" />
      <path
        d="M10.8 5.3a4.2 4.2 0 0 1 0 5.4M12.6 3.6a6.8 6.8 0 0 1 0 8.8"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  )
}

export function MiniPlayer() {
  const {
    track,
    playing,
    buffering,
    currentTime,
    duration,
    volume,
    muted,
    togglePlay,
    seek,
    close,
    upNext,
    repeat,
    toggleRepeat,
    removeFromQueue,
    load,
    setVolume,
    toggleMute,
  } = usePlayer()
  const [queueOpen, setQueueOpen] = useState(false)

  if (!track) return null

  const progress = duration > 0 ? currentTime / duration : 0

  return (
    <div className="mini-player" data-testid="mini-player" role="region" aria-label="Now playing">
      {queueOpen && (
        <div className="mini-player-queue" role="region" aria-label="Play queue">
          <div className="mini-player-queue__header">
            <span className="mini-player-queue__label">Up next</span>
          </div>
          {upNext.length === 0 ? (
            <p className="mini-player-queue__empty">Nothing queued — add tracks to play next.</p>
          ) : (
            <ul className="mini-player-queue__list">
              {upNext.map((item) => (
                <QueueItem
                  key={item.id}
                  item={item}
                  onPlay={() => load(item, { autoplay: true })}
                  onRemove={() => removeFromQueue(item.id)}
                />
              ))}
            </ul>
          )}
        </div>
      )}
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
        {track.artworkUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={track.artworkUrl} alt="" className="mini-player__art" />
        ) : (
          <AvatarTile size="xs" name={track.title} className="mini-player__art" />
        )}
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
          <span className="mini-player__badge">{track.isReplay ? 'REPLAY' : 'LIVE'}</span>
        ) : (
          <span className="mini-player__time">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        )}
        <div className="mini-player__volume">
          <button
            type="button"
            className="mini-player__mute"
            onClick={toggleMute}
            aria-pressed={muted}
            aria-label={muted ? 'Unmute' : 'Mute'}
            title={muted ? 'Unmute' : 'Mute'}
          >
            <VolumeIcon muted={muted} volume={volume} />
          </button>
          <input
            type="range"
            className="mini-player__volume-slider"
            min={0}
            max={100}
            value={Math.round((muted ? 0 : volume) * 100)}
            onChange={(e) => setVolume(Number(e.target.value) / 100)}
            aria-label="Volume"
          />
        </div>
        <button
          type="button"
          className={`mini-player__repeat${repeat ? ' mini-player__repeat--active' : ''}`}
          onClick={toggleRepeat}
          aria-pressed={repeat}
          aria-label={repeat ? 'Repeat queue: on' : 'Repeat queue: off'}
          title={repeat ? 'Repeat queue: on' : 'Repeat queue: off'}
        >
          ⟲
        </button>
        <button
          type="button"
          className={`mini-player__queue-toggle${queueOpen ? ' mini-player__queue-toggle--active' : ''}`}
          onClick={() => setQueueOpen((v) => !v)}
          aria-expanded={queueOpen}
          aria-label="Toggle play queue"
        >
          {upNext.length > 0 ? `Queue · ${upNext.length}` : 'Queue'}
        </button>
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
