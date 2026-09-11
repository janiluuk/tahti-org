'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>
import { resolveClientApiUrl } from '@/lib/api-url'

import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { AvatarTile } from '@tahti/ui'
import type { PlayerTrack } from '@/contexts/player-context'
import { ChannelVisualizer } from '@/components/visuals/channel-visualizer'
import { SoundWaveform, type WaveformMarker } from '@/components/sound-waveform'
import { LoginPromptModal } from '@/components/login-prompt-modal'
import { HearthisEmbedSurface } from '@/contexts/player-embed-plugins/hearthis-embed-plugin'

import { formatTime } from './format-time'
import { useTrackPlaybackDetails } from './use-track-playback-details'
import { VolumeIcon } from './volume-icon'
import { REACTION_TYPES, type TrackReactionItem, type TrackReactionType } from './types'

const API_URL = resolveClientApiUrl()

/** Full-viewport "now playing" sheet — big artwork, big transport, an easily
 * tappable seek bar. Opened from the mini-player's expand affordance; mainly
 * for mobile, where the collapsed bar's controls are too small to use well. */
export function FullPlayerSheet({
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
  seek: (ratio: number) => void
  setVolume: (v: number) => void
  toggleMute: () => void
  onClose: () => void
  closing: boolean
}) {
  const progress = duration > 0 ? currentTime / duration : 0
  const seekable = track.kind === 'sound' && duration > 0
  const [details, setDetails] = useTrackPlaybackDetails(track.kind === 'sound' ? track.id : null)
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
    if (track.kind !== 'sound' || postingReaction) return
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
              <SoundWaveform
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
            {track.kind === 'sound' && (
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
