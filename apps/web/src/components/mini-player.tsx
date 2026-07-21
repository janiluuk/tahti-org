// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, type DragEvent } from 'react'
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
  draggable,
  dragged,
  dragOver,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  item: PlayerTrack
  onPlay: () => void
  onRemove?: () => void
  draggable?: boolean
  dragged?: boolean
  dragOver?: boolean
  onDragStart?: () => void
  onDragOver?: (e: DragEvent) => void
  onDrop?: () => void
  onDragEnd?: () => void
}) {
  return (
    <li
      className={`mini-player-queue__item${dragged ? ' mini-player-queue__item--dragging' : ''}${dragOver ? ' mini-player-queue__item--drag-over' : ''}`}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      {draggable && (
        <span className="mini-player-queue__drag-handle" aria-hidden>
          <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
            <circle cx="2.5" cy="2.5" r="1.4" />
            <circle cx="7.5" cy="2.5" r="1.4" />
            <circle cx="2.5" cy="8" r="1.4" />
            <circle cx="7.5" cy="8" r="1.4" />
            <circle cx="2.5" cy="13.5" r="1.4" />
            <circle cx="7.5" cy="13.5" r="1.4" />
          </svg>
        </span>
      )}
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
      {onRemove && (
        <button
          type="button"
          className="mini-player-queue__remove"
          onClick={onRemove}
          aria-label={`Remove ${item.title} from queue`}
        >
          ✕
        </button>
      )}
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
    playNext,
    playPrevious,
    seek,
    close,
    queue,
    upNext,
    history,
    repeat,
    toggleRepeat,
    removeFromQueue,
    clearQueue,
    reorderUpNext,
    load,
    setVolume,
    toggleMute,
  } = usePlayer()
  const [queueOpen, setQueueOpen] = useState(false)
  const [queueTab, setQueueTab] = useState<'queue' | 'history'>('queue')
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  if (!track) return null

  const progress = duration > 0 ? currentTime / duration : 0
  const canSkip = queue.length > 1

  function handleDrop(targetIndex: number) {
    if (dragIndex !== null && dragIndex !== targetIndex) {
      const next = [...upNext]
      const [moved] = next.splice(dragIndex, 1)
      next.splice(targetIndex, 0, moved!)
      reorderUpNext(next)
    }
    setDragIndex(null)
    setDragOverIndex(null)
  }

  return (
    <div className="mini-player" data-testid="mini-player" role="region" aria-label="Now playing">
      {queueOpen && (
        <div className="mini-player-queue" role="region" aria-label="Play queue">
          <div className="mini-player-queue__header">
            <div className="mini-player-queue__tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={queueTab === 'queue'}
                className={`mini-player-queue__tab${queueTab === 'queue' ? ' mini-player-queue__tab--active' : ''}`}
                onClick={() => setQueueTab('queue')}
              >
                Queue{upNext.length > 0 ? ` · ${upNext.length}` : ''}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={queueTab === 'history'}
                className={`mini-player-queue__tab${queueTab === 'history' ? ' mini-player-queue__tab--active' : ''}`}
                onClick={() => setQueueTab('history')}
              >
                History
              </button>
            </div>
            {queueTab === 'queue' && (
              <div className="mini-player-queue__header-actions">
                <button
                  type="button"
                  className={`mini-player-queue__repeat${repeat ? ' mini-player-queue__repeat--active' : ''}`}
                  onClick={toggleRepeat}
                  aria-pressed={repeat}
                  title={repeat ? 'Repeat queue: on' : 'Repeat queue: off'}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
                    <path
                      d="M3 6a3 3 0 0 1 3-3h6M12 3l-2-2m2 2-2 2"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M13 10a3 3 0 0 1-3 3H4M4 13l2 2m-2-2 2-2"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Repeat
                </button>
                <button
                  type="button"
                  className="mini-player-queue__clear"
                  onClick={clearQueue}
                  disabled={upNext.length === 0}
                  aria-label="Clear queue"
                  title="Clear queue"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
                    <path
                      d="M3 4.5h10M6.5 4.5V3a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1.5M4 4.5l.6 8.1a1 1 0 0 0 1 .9h4.8a1 1 0 0 0 1-.9l.6-8.1"
                      stroke="currentColor"
                      strokeWidth="1.3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            )}
          </div>

          {queueTab === 'queue' ? (
            upNext.length === 0 ? (
              <p className="mini-player-queue__empty">Nothing queued — add tracks to play next.</p>
            ) : (
              <ul className="mini-player-queue__list">
                {upNext.map((item, i) => (
                  <QueueItem
                    key={item.id}
                    item={item}
                    onPlay={() => load(item, { autoplay: true })}
                    onRemove={() => removeFromQueue(item.id)}
                    draggable
                    dragged={dragIndex === i}
                    dragOver={dragOverIndex === i}
                    onDragStart={() => setDragIndex(i)}
                    onDragOver={(e) => {
                      e.preventDefault()
                      setDragOverIndex(i)
                    }}
                    onDrop={() => handleDrop(i)}
                    onDragEnd={() => {
                      setDragIndex(null)
                      setDragOverIndex(null)
                    }}
                  />
                ))}
              </ul>
            )
          ) : history.length === 0 ? (
            <p className="mini-player-queue__empty">Nothing played yet.</p>
          ) : (
            <ul className="mini-player-queue__list">
              {history.map((item) => (
                <QueueItem key={item.id} item={item} onPlay={() => load(item, { autoplay: true })} />
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
        <div className="mini-player__transport">
          <button
            type="button"
            className="mini-player__skip"
            onClick={playPrevious}
            disabled={!canSkip}
            aria-label="Previous track"
            title="Previous track"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
              <rect x="2.5" y="2" width="2" height="12" rx="0.5" />
              <path d="M13 2.5v11l-8-5.5 8-5.5z" />
            </svg>
          </button>
          <button
            type="button"
            className={`mini-player__play${buffering ? ' mini-player__play--buffering' : ''}`}
            onClick={() => void togglePlay()}
            aria-label={playing ? 'Pause' : 'Play'}
            disabled={buffering}
          >
            {buffering ? (
              <span className="mini-player__spinner" aria-hidden />
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
          <button
            type="button"
            className="mini-player__skip"
            onClick={playNext}
            disabled={!canSkip}
            aria-label="Next track"
            title="Next track"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
              <path d="M3 2.5v11l8-5.5-8-5.5z" />
              <rect x="11.5" y="2" width="2" height="12" rx="0.5" />
            </svg>
          </button>
        </div>
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
