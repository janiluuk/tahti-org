// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useCallback, useEffect, useMemo, useRef, type DragEvent } from 'react'
import Link from 'next/link'
import { AvatarTile } from '@tahti/ui'
import { usePlayer, type PlayerTrack } from '@/contexts/player-context'
import { ChannelVisualizer } from '@/components/visuals/channel-visualizer'
import { AddToCollectionPanel } from '@/components/add-to-collection-panel'
import { ArchiveWaveform, type WaveformMarker } from '@/components/archive-waveform'
import { LoginPromptModal } from '@/components/login-prompt-modal'
import { fetchMyCollections, type MyCollectionSummary } from '@/app/dashboard/collection-actions'
import { HearthisEmbedSurface } from '@/contexts/player-embed-plugins/hearthis-embed-plugin'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

type TrackReactionType = 'LOVE' | 'LAUGH' | 'SURPRISE' | 'HANDS_UP'

interface TrackReactionItem {
  id: string
  type: TrackReactionType
  positionSec: number
  createdAt: string
}

interface TracklistCue {
  startSec: number
  title: string
  artist?: string | null
}

interface BroadcastReactionItem {
  emoji: string
  elapsedSec: number
}

interface TrackPlaybackDetails {
  title: string
  artistName: string
  artistAvatarUrl: string | null
  channelSlug: string
  tracklist: TracklistCue[] | null
  peaks: number[] | null
  reactions: TrackReactionItem[]
  /** Flying-emoji reactions fired live during the original broadcast, if
   * this track was recorded from one — replayed at matching elapsedSec
   * during archive playback. Empty for tracks with no linked broadcast. */
  broadcastReactions: BroadcastReactionItem[]
}

const REACTION_TYPES: { type: TrackReactionType; emoji: string; label: string }[] = [
  { type: 'LOVE', emoji: '❤️', label: 'Love' },
  { type: 'LAUGH', emoji: '😂', label: 'Laugh' },
  { type: 'SURPRISE', emoji: '😮', label: 'Surprise' },
  { type: 'HANDS_UP', emoji: '🙌', label: 'Hands up' },
]

/** Waveform peaks + reaction markers + show identity for the currently-loaded archive
 * track — a visual extra, so any fetch failure just leaves details null (the plain
 * progress bar and meta block still work fine without it). Polls while the sheet is
 * open so other listeners' reactions show up without a manual refresh. */
function useTrackPlaybackDetails(trackId: string | null) {
  const [details, setDetails] = useState<TrackPlaybackDetails | null>(null)

  useEffect(() => {
    setDetails(null)
    if (!trackId) return
    let cancelled = false

    async function fetchDetails() {
      try {
        const res = await fetch(`${API_URL}/api/reactions/track/${trackId}`)
        if (!res.ok || cancelled) return
        const data = (await res.json()) as TrackPlaybackDetails
        if (!cancelled) setDetails(data)
      } catch {
        // waveform/reactions are a visual extra, not required for playback
      }
    }

    void fetchDetails()
    const interval = window.setInterval(() => void fetchDetails(), 15_000)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [trackId])

  return [details, setDetails] as const
}

export function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** Thumbnail-only queue/history row — the redesigned queue panel shows
 * artwork alone (title is available via the native `title` tooltip) so
 * three columns (history / now playing / up next) fit side by side. */
function QueueThumb({
  item,
  active,
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
  active?: boolean
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
      className={`mini-player-queue__thumb-item${active ? ' mini-player-queue__thumb-item--active' : ''}${dragged ? ' mini-player-queue__thumb-item--dragging' : ''}${dragOver ? ' mini-player-queue__thumb-item--drag-over' : ''}`}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      <button
        type="button"
        className="mini-player-queue__thumb-play"
        onClick={onPlay}
        aria-label={active ? `${item.title} — now playing` : `Skip to ${item.title}`}
        aria-current={active ? 'true' : undefined}
        title={item.subtitle ? `${item.title} — ${item.subtitle}` : item.title}
      >
        {item.artworkUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.artworkUrl} alt="" className="mini-player-queue__thumb-art" />
        ) : (
          <AvatarTile size="sm" name={item.title} className="mini-player-queue__thumb-art" />
        )}
      </button>
      {onRemove && (
        <button
          type="button"
          className="mini-player-queue__thumb-remove"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          aria-label={`Remove ${item.title} from queue`}
          title="Remove from queue"
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
      <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden>
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
      <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden>
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
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden>
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

/** Full-viewport "now playing" sheet — big artwork, big transport, an easily
 * tappable seek bar. Opened from the mini-player's expand affordance; mainly
 * for mobile, where the collapsed bar's controls are too small to use well. */
function FullPlayerSheet({
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
  canSkip,
  shuffle,
  toggleShuffle,
  repeat,
  toggleRepeat,
  seek,
  setVolume,
  toggleMute,
  onClose,
  closing,
}: {
  track: PlayerTrack
  playing: boolean
  buffering: boolean
  currentTime: number
  duration: number
  volume: number
  muted: boolean
  analyser: AnalyserNode | null
  togglePlay: () => void | Promise<void>
  playNext: () => void
  playPrevious: () => void
  canSkip: boolean
  shuffle: boolean
  toggleShuffle: () => void
  repeat: boolean
  toggleRepeat: () => void
  seek: (ratio: number) => void
  setVolume: (v: number) => void
  toggleMute: () => void
  onClose: () => void
  closing: boolean
}) {
  const progress = duration > 0 ? currentTime / duration : 0
  const seekable = track.kind === 'archive' && duration > 0
  const [details, setDetails] = useTrackPlaybackDetails(track.kind === 'archive' ? track.id : null)
  const [showLoginPrompt, setShowLoginPrompt] = useState(false)
  const [postingReaction, setPostingReaction] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const [flyingReactions, setFlyingReactions] = useState<
    { id: string; emoji: string; x: number }[]
  >([])
  const lastReactionCheckRef = useRef(0)

  // Replays the broadcast's original flying-emoji reactions at the same
  // moments they happened live, as playback crosses each elapsedSec — same
  // visual as ReactionsOverlay's live version, so an archived show still
  // feels like it did in the room. Only fires reactions within a small
  // forward window of the last tick; a big jump (seek/scrub) just resyncs
  // the marker instead of flooding the screen with every reaction skipped
  // over.
  useEffect(() => {
    const last = lastReactionCheckRef.current
    lastReactionCheckRef.current = currentTime
    if (!details?.broadcastReactions?.length) return
    const jumped = currentTime < last || currentTime - last > 5
    if (jumped) return
    for (const r of details.broadcastReactions) {
      if (r.elapsedSec > last && r.elapsedSec <= currentTime) {
        const id = `${r.elapsedSec}-${Math.random()}`
        const x = 10 + Math.random() * 80
        setFlyingReactions((prev) => [...prev.slice(-20), { id, emoji: r.emoji, x }])
        setTimeout(() => setFlyingReactions((prev) => prev.filter((f) => f.id !== id)), 2500)
      }
    }
  }, [currentTime, details?.broadcastReactions])

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      void document.exitFullscreen()
    } else {
      void rootRef.current?.requestFullscreen()
    }
  }

  async function postReaction(type: TrackReactionType) {
    if (track.kind !== 'archive' || postingReaction) return
    setPostingReaction(true)
    try {
      const res = await fetch(`${API_URL}/api/reactions/track/${track.id}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, positionSec: currentTime }),
      })
      if (res.status === 401) {
        setShowLoginPrompt(true)
        return
      }
      if (!res.ok) return
      const created = (await res.json()) as TrackReactionItem
      setDetails((prev) => (prev ? { ...prev, reactions: [...prev.reactions, created] } : prev))
    } finally {
      setPostingReaction(false)
    }
  }

  const markers: WaveformMarker[] = useMemo(() => {
    if (!details || duration <= 0) return []
    return details.reactions.map((r) => ({
      id: r.id,
      ratio: Math.min(1, Math.max(0, r.positionSec / duration)),
      emoji: REACTION_TYPES.find((t) => t.type === r.type)?.emoji ?? '❤️',
    }))
  }, [details, duration])

  const currentCue = useMemo(() => {
    if (!details?.tracklist || details.tracklist.length === 0) return null
    const sorted = [...details.tracklist].sort((a, b) => a.startSec - b.startSec)
    let cue = sorted[0]!
    for (const entry of sorted) {
      if (entry.startSec <= currentTime) cue = entry
      else break
    }
    return cue
  }, [details?.tracklist, currentTime])

  return (
    <div
      ref={rootRef}
      data-tahti-ui="brand"
      className={`full-player${closing ? ' full-player--closing' : ''}${isFullscreen ? ' full-player--fullscreen' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Now playing"
    >
      <ChannelVisualizer
        preset="WATER_RIPPLE"
        analyser={analyser}
        artworkUrl={track.artworkUrl}
        className="full-player__viz"
      />
      {track.artworkUrl && (
        <div
          className="full-player__backdrop"
          style={{ backgroundImage: `url(${track.artworkUrl})` }}
          aria-hidden
        />
      )}
      {flyingReactions.length > 0 && (
        <div className="ch-reactions full-player__reactions-replay" aria-hidden>
          {flyingReactions.map((fr) => (
            <span
              key={fr.id}
              className="ch-reaction-fly"
              style={{ ['--ch-reaction-x' as string]: `${fr.x}%` }}
            >
              {fr.emoji}
            </span>
          ))}
        </div>
      )}
      <div className="full-player__topbar">
        <button
          type="button"
          className="full-player__collapse"
          onClick={onClose}
          aria-label="Close player"
          title="Close player"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M5 5l14 14m0-14L5 19"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          </svg>
        </button>
        <button
          type="button"
          className="full-player__fullscreen-toggle"
          onClick={toggleFullscreen}
          aria-pressed={isFullscreen}
          aria-label={isFullscreen ? 'Minimize' : 'Fullscreen'}
          title={isFullscreen ? 'Minimize' : 'Fullscreen'}
        >
          {isFullscreen ? (
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path
                d="M6 2v3a1 1 0 0 1-1 1H2M10 2v3a1 1 0 0 0 1 1h3M6 14v-3a1 1 0 0 0-1-1H2M10 14v-3a1 1 0 0 1 1-1h3"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path
                d="M2 5V2h3M11 2h3v3M14 11v3h-3M5 14H2v-3"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>
      </div>

      <div className="full-player__art-wrap">
        {track.artworkUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={track.artworkUrl} alt="" className="full-player__art" />
        ) : (
          <AvatarTile size="full" name={track.title} className="full-player__art" />
        )}
      </div>

      {isFullscreen && details ? (
        <div className="full-player__cinema-meta">
          <div key={details.title} className="full-player__cinema-show-name">
            {details.title}
          </div>
          <div key={details.artistName} className="full-player__cinema-identity">
            {details.artistAvatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={details.artistAvatarUrl} alt="" className="full-player__cinema-avatar" />
            ) : (
              <AvatarTile size="sm" name={details.artistName} />
            )}
            <span>{details.artistName}</span>
          </div>
          {currentCue && (
            <div
              key={`${currentCue.startSec}-${currentCue.title}`}
              className="full-player__cinema-cue"
            >
              <span className="full-player__cinema-cue-title">{currentCue.title}</span>
              {currentCue.artist && (
                <span className="full-player__cinema-cue-artist">{currentCue.artist}</span>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="full-player__meta">
          {track.href ? (
            <Link href={track.href} className="full-player__title" onClick={onClose}>
              {track.title}
            </Link>
          ) : (
            <span className="full-player__title">{track.title}</span>
          )}
          {track.subtitle && <span className="full-player__subtitle">{track.subtitle}</span>}
          {track.kind === 'live' && (
            <span
              className={`mini-player__badge full-player__badge${track.isReplay ? ' mini-player__badge--replay' : ''}`}
            >
              {track.isReplay ? 'REPLAY' : 'LIVE'}
            </span>
          )}
        </div>
      )}

      <div className="full-player__seek">
        {track.embed ? (
          <HearthisEmbedSurface
            embedUri={track.embed.embedUri}
            title={track.title}
            autoplay={playing}
          />
        ) : seekable ? (
          <>
            {details?.peaks && details.peaks.length > 0 ? (
              <ArchiveWaveform
                peaks={details.peaks}
                progress={progress}
                onSeek={seek}
                markers={markers}
                size={isFullscreen ? 'large' : 'default'}
              />
            ) : (
              <button
                type="button"
                className="full-player__progress"
                aria-label="Seek"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  seek((e.clientX - rect.left) / rect.width)
                }}
              >
                <span
                  className="full-player__progress-fill"
                  style={{ width: `${progress * 100}%` }}
                />
                <span
                  className="full-player__progress-thumb"
                  style={{ left: `${progress * 100}%` }}
                />
              </button>
            )}
            <div className="full-player__times">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
            {track.kind === 'archive' && (
              <div className="full-player__reactions" role="group" aria-label="React to this track">
                {REACTION_TYPES.map((r) => (
                  <button
                    key={r.type}
                    type="button"
                    className="full-player__reaction-btn"
                    onClick={() => void postReaction(r.type)}
                    disabled={postingReaction}
                    aria-label={r.label}
                    title={r.label}
                  >
                    {r.emoji}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : null}
      </div>
      {showLoginPrompt && (
        <LoginPromptModal
          message="Sign in to react to this track."
          onClose={() => setShowLoginPrompt(false)}
        />
      )}

      <div className="full-player__transport">
        <button
          type="button"
          className={`full-player__mode${shuffle ? ' full-player__mode--active' : ''}`}
          onClick={toggleShuffle}
          disabled={!canSkip}
          aria-pressed={shuffle}
          aria-label={shuffle ? 'Shuffle: on' : 'Shuffle: off'}
          title={shuffle ? 'Shuffle: on' : 'Shuffle: off'}
        >
          <svg width="20" height="20" viewBox="0 0 16 16" fill="none" aria-hidden>
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
          className="full-player__skip"
          onClick={playPrevious}
          disabled={!canSkip}
          aria-label="Previous track"
        >
          <svg width="22" height="22" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
            <rect x="2.5" y="2" width="2" height="12" rx="0.5" />
            <path d="M13 2.5v11l-8-5.5 8-5.5z" />
          </svg>
        </button>
        <button
          type="button"
          className={`full-player__play${buffering ? ' full-player__play--buffering' : ''}`}
          onClick={() => void togglePlay()}
          aria-label={track.embed ? 'Use the hearthis.at player above' : playing ? 'Pause' : 'Play'}
          title={track.embed ? 'Use the hearthis.at player above' : undefined}
          disabled={buffering || Boolean(track.embed)}
        >
          {buffering ? (
            <span className="mini-player__spinner" aria-hidden />
          ) : playing ? (
            <svg width="30" height="30" viewBox="0 0 18 18" fill="currentColor" aria-hidden>
              <rect x="3" y="2" width="4" height="14" rx="1" />
              <rect x="11" y="2" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg width="30" height="30" viewBox="0 0 18 18" fill="currentColor" aria-hidden>
              <path d="M5 3l11 6-11 6V3z" />
            </svg>
          )}
        </button>
        <button
          type="button"
          className="full-player__skip"
          onClick={playNext}
          disabled={!canSkip}
          aria-label="Next track"
        >
          <svg width="22" height="22" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
            <path d="M3 2.5v11l8-5.5-8-5.5z" />
            <rect x="11.5" y="2" width="2" height="12" rx="0.5" />
          </svg>
        </button>
        <button
          type="button"
          className={`full-player__mode${repeat ? ' full-player__mode--active' : ''}`}
          onClick={toggleRepeat}
          disabled={!canSkip}
          aria-pressed={repeat}
          aria-label={repeat ? 'Loop: on' : 'Loop: off'}
          title={repeat ? 'Loop: on' : 'Loop: off'}
        >
          <svg width="20" height="20" viewBox="0 0 16 16" fill="none" aria-hidden>
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

      <div className="full-player__volume">
        <button
          type="button"
          className="mini-player__mute"
          onClick={toggleMute}
          aria-pressed={muted}
          aria-label={muted ? 'Unmute' : 'Mute'}
        >
          <VolumeIcon muted={muted} volume={volume} />
        </button>
        <input
          type="range"
          className="full-player__volume-slider"
          min={0}
          max={100}
          value={Math.round((muted ? 0 : volume) * 100)}
          onChange={(e) => setVolume(Number(e.target.value) / 100)}
          aria-label="Volume"
        />
      </div>
    </div>
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
  // bar — its play/pause/seek is inert (see PlayerTrack.embed) — so jump
  // straight to the full player, which mounts the real, interactive widget.
  // Otherwise a freshly-loaded hearthis track would look identical to a dead
  // click: the bar shows up, nothing else visibly happens.
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
        {addToOpen && track.kind === 'archive' && (
          <AddToCollectionPanel
            archiveItemId={track.id}
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
              <div className="mini-player-queue__toolbar-group">
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
          </div>
        )}
        {track.kind === 'archive' && duration > 0 && (
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
          {track.kind === 'archive' && (
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
      {expanded && (
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
          shuffle={shuffle}
          toggleShuffle={toggleShuffle}
          repeat={repeat}
          toggleRepeat={toggleRepeat}
          seek={seek}
          setVolume={setVolume}
          toggleMute={toggleMute}
          onClose={closeFullPlayer}
          closing={closingFullPlayer}
        />
      )}
    </>
  )
}
