'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { AvatarTile } from '@tahti/ui'
import { usePlayer } from '@/contexts/player-context'
import { AddToCollectionPanel } from '@/components/add-to-collection-panel'
import { fetchMyCollections, type MyCollectionSummary } from '@/app/dashboard/collection-actions'

import { formatTime } from './format-time'
import { QueueThumb } from './queue-thumb'
import { VolumeIcon } from './volume-icon'
import { EmbedPlayerModal } from './embed-player-modal'
import { FullPlayerSheet } from './full-player-sheet'

export function MiniPlayer() {
  const {
    track,
    playing,
    buffering,
    currentTime,
    duration,
    volume,
    muted,
    analyser,
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
    shuffle,
    toggleShuffle,
    removeFromQueue,
    clearQueue,
    reorderUpNext,
    load,
    setVolume,
    toggleMute,
    queueFlashSignal,
  } = usePlayer()
  const [queueOpen, setQueueOpen] = useState(false)
  const [queueClosing, setQueueClosing] = useState(false)
  const [queueFlash, setQueueFlash] = useState(false)

  // Pulse the queue-toggle button whenever anything is added to the queue —
  // from this component or from any other page's "add to queue" button.
  useEffect(() => {
    if (queueFlashSignal === 0) return
    setQueueFlash(true)
    const timer = setTimeout(() => setQueueFlash(false), 700)
    return () => clearTimeout(timer)
  }, [queueFlashSignal])
  const [addToOpen, setAddToOpen] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [closingFullPlayer, setClosingFullPlayer] = useState(false)
  const [collections, setCollections] = useState<MyCollectionSummary[] | null>(null)

  const closeFullPlayer = useCallback(() => {
    setClosingFullPlayer(true)
    window.setTimeout(() => {
      setExpanded(false)
      setClosingFullPlayer(false)
    }, 280)
  }, [])

  const closeQueue = useCallback(() => {
    setQueueClosing(true)
    window.setTimeout(() => {
      setQueueOpen(false)
      setQueueClosing(false)
    }, 200)
  }, [])

  // Lazy-load "your collections" the first time the queue panel opens — a
  // logged-out listener or one with no collections just gets an empty list
  // back and the section stays hidden, no extra request on every page load.
  useEffect(() => {
    if (!queueOpen || collections !== null) return
    let cancelled = false
    void (async () => {
      const { data } = await fetchMyCollections()
      if (!cancelled && data) setCollections(data)
    })()
    return () => {
      cancelled = true
    }
  }, [queueOpen, collections])

  // An embed track (hearthis.at) has no working transport in the collapsed
  // bar — its play/pause/seek is inert (see PlayerTrack.embed) — so open
  // EmbedPlayerModal, which mounts the real, interactive widget. Otherwise a
  // freshly-loaded hearthis track would look identical to a dead click: the
  // bar shows up, nothing else visibly happens.
  useEffect(() => {
    if (track?.embed) setExpanded(true)
  }, [track?.id, track?.embed])

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
    <>
      <div
        className={`mini-player${playing ? ' mini-player--playing' : ''}`}
        data-testid="mini-player"
        role="region"
        aria-label="Now playing"
      >
        {addToOpen && track.kind === 'sound' && (
          <AddToCollectionPanel
            soundId={track.id}
            trackTitle={track.title}
            onClose={() => setAddToOpen(false)}
          />
        )}
        {(queueOpen || queueClosing) && (
          <div
            className={`mini-player-queue${queueClosing ? ' mini-player-queue--closing' : ''}`}
            role="region"
            aria-label="Play queue"
          >
            <div className="mini-player-queue__toolbar">
              <span className="mini-player-queue__toolbar-title">Play queue</span>
              <div className="mini-player-queue__toolbar-group">
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
                <button
                  type="button"
                  className="mini-player-queue__collapse"
                  onClick={closeQueue}
                  aria-label="Collapse queue"
                  title="Collapse queue"
                >
                  <svg width="12" height="12" viewBox="0 0 10 10" fill="none" aria-hidden>
                    <path
                      d="M2 6.5L5 3.5L8 6.5"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            </div>

            <div className="mini-player-queue__columns">
              <div className="mini-player-queue__column mini-player-queue__column--history">
                <span className="mini-player-queue__column-label">History</span>
                {history.filter((item) => item.id !== track.id).length === 0 ? (
                  <p className="mini-player-queue__empty">Nothing played yet.</p>
                ) : (
                  <ul className="mini-player-queue__thumbs">
                    {history
                      .filter((item) => item.id !== track.id)
                      .map((item) => (
                        <QueueThumb
                          key={item.id}
                          item={item}
                          onPlay={() => load(item, { autoplay: true })}
                        />
                      ))}
                  </ul>
                )}
              </div>

              <div className="mini-player-queue__column mini-player-queue__column--current">
                <span className="mini-player-queue__column-label">Now playing</span>
                <div className="mini-player-queue__current" title={track.title}>
                  {track.artworkUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={track.artworkUrl} alt="" className="mini-player-queue__current-art" />
                  ) : (
                    <AvatarTile
                      size="md"
                      name={track.title}
                      className="mini-player-queue__current-art"
                    />
                  )}
                  <span className="mini-player-queue__current-title">{track.title}</span>
                  {track.subtitle && (
                    <span className="mini-player-queue__current-subtitle">{track.subtitle}</span>
                  )}
                </div>
              </div>

              <div className="mini-player-queue__column mini-player-queue__column--upnext">
                <span className="mini-player-queue__column-label">
                  Queue{upNext.length > 0 ? ` · ${upNext.length}` : ''}
                </span>
                {upNext.length === 0 ? (
                  <p className="mini-player-queue__empty">Nothing queued.</p>
                ) : (
                  <ul className="mini-player-queue__thumbs">
                    {upNext.map((item, i) => (
                      <QueueThumb
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
                )}
              </div>
            </div>

            {collections !== null && collections.length > 0 && (
              <div className="mini-player-queue__collections">
                <span className="mini-player-queue__column-label">Your collections</span>
                <ul className="mini-player-queue__collections-list">
                  {collections.map((c) => (
                    <li key={c.slug}>
                      <Link
                        href={`/dashboard/collections/${c.slug}`}
                        className="mini-player-queue__collection-chip"
                        onClick={closeQueue}
                        title={c.name}
                      >
                        <AvatarTile size="xs" name={c.name} />
                        <span className="mini-player-queue__collection-name">{c.name}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mini-player-queue__footer">
              <button
                type="button"
                className={`mini-player-queue__mode${shuffle ? ' mini-player-queue__mode--active' : ''}`}
                onClick={toggleShuffle}
                disabled={queue.length < 2}
                aria-pressed={shuffle}
                aria-label={shuffle ? 'Shuffle: on' : 'Shuffle: off'}
                title={shuffle ? 'Shuffle: on' : 'Shuffle: off'}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <path
                    d="M2 4h3.2l6 8H14M14 4h-2.8L9.5 6.3M2 12h3.2l1.7-2.3M12.5 2.5 14 4l-1.5 1.5M12.5 10.5 14 12l-1.5 1.5"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <button
                type="button"
                className={`mini-player-queue__mode${repeat ? ' mini-player-queue__mode--active' : ''}`}
                onClick={toggleRepeat}
                disabled={queue.length < 2}
                aria-pressed={repeat}
                aria-label={repeat ? 'Loop: on' : 'Loop: off'}
                title={repeat ? 'Loop: on' : 'Loop: off'}
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
              </button>
            </div>
          </div>
        )}
        {track.kind === 'sound' && duration > 0 && (
          <button
            type="button"
            className="mini-player__progress"
            aria-label="Seek"
            aria-valuenow={Math.round(progress * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            role="slider"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              seek((e.clientX - rect.left) / rect.width)
            }}
          >
            <span className="mini-player__progress-fill" style={{ width: `${progress * 100}%` }} />
            <span className="mini-player__progress-thumb" style={{ left: `${progress * 100}%` }} />
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
              onClick={() => (track.embed ? setExpanded(true) : void togglePlay())}
              aria-label={track.embed ? 'Open hearthis.at player' : playing ? 'Pause' : 'Play'}
              title={track.embed ? 'Open hearthis.at player' : undefined}
              disabled={buffering}
            >
              {buffering ? (
                <span className="mini-player__spinner" aria-hidden />
              ) : track.embed ? (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <path
                    d="M4 9v3h3M12 7V4H9M4.5 11.5 11.5 4.5"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
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
          <button
            type="button"
            className="mini-player__now-playing"
            onClick={() => setExpanded(true)}
            aria-label="Open full player"
          >
            {track.artworkUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={track.artworkUrl} alt="" className="mini-player__art" />
            ) : (
              <AvatarTile size="xs" name={track.title} className="mini-player__art" />
            )}
            <div className="mini-player__info">
              <span className="mini-player__title">{track.title}</span>
              {track.subtitle && <span className="mini-player__subtitle">{track.subtitle}</span>}
            </div>
          </button>
          {track.kind === 'live' ? (
            <span
              className={`mini-player__badge${track.isReplay ? ' mini-player__badge--replay' : ''}`}
            >
              {track.isReplay ? 'REPLAY' : 'LIVE'}
            </span>
          ) : track.embed ? (
            <span className="mini-player__badge" title="Playing via hearthis.at's own widget">
              HEARTHIS
            </span>
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
          {track.kind === 'sound' && (
            <button
              type="button"
              className={`mini-player__add-to${addToOpen ? ' mini-player__add-to--active' : ''}`}
              onClick={() => {
                if (queueOpen) closeQueue()
                setAddToOpen((v) => !v)
              }}
              aria-expanded={addToOpen}
              aria-label="Add to playlist"
              title="Add to playlist"
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path
                  d="M2 4.5h8M2 8h6M2 11.5h4"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
                <path
                  d="M12.5 7v6M9.5 10h6"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          )}
          <button
            type="button"
            className={`mini-player__queue-toggle${queueOpen ? ' mini-player__queue-toggle--active' : ''}${queueFlash ? ' mini-player__queue-toggle--flash' : ''}`}
            onClick={() => {
              if (queueOpen) {
                closeQueue()
              } else {
                setAddToOpen(false)
                setQueueOpen(true)
              }
            }}
            aria-expanded={queueOpen}
            aria-label="Toggle play queue"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path
                d="M2 4.5h8M2 8h8M2 11.5h5"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
            {upNext.length > 0 && <span>{upNext.length}</span>}
            {queueOpen ? (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
                <path
                  d="M2 3.5L5 6.5L8 3.5"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
                <path
                  d="M2 6.5L5 3.5L8 6.5"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
          <button
            type="button"
            className="mini-player__expand"
            onClick={() => setExpanded(true)}
            aria-label="Open full player"
            title="Open full player"
          >
            <svg width="12" height="12" viewBox="0 0 10 10" fill="none" aria-hidden>
              <path
                d="M2 6.5L5 3.5L8 6.5"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button
            type="button"
            className="mini-player__close"
            onClick={close}
            aria-label="Close player"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path
                d="M3.5 3.5l9 9m0-9l-9 9"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>
      {expanded &&
        (track.embed ? (
          <EmbedPlayerModal
            track={track}
            playing={playing}
            onClose={closeFullPlayer}
            closing={closingFullPlayer}
          />
        ) : (
          <FullPlayerSheet
            track={track}
            playing={playing}
            buffering={buffering}
            currentTime={currentTime}
            duration={duration}
            volume={volume}
            muted={muted}
            analyser={analyser}
            togglePlay={togglePlay}
            playNext={playNext}
            playPrevious={playPrevious}
            canSkip={canSkip}
            seek={seek}
            setVolume={setVolume}
            toggleMute={toggleMute}
            onClose={closeFullPlayer}
            closing={closingFullPlayer}
          />
        ))}
    </>
  )
}
