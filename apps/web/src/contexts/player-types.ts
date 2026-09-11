// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { RefObject } from 'react'
import type { PlayerEmbedSource } from './player-embed-plugins/hearthis-embed-plugin'

export interface PlayerTrack {
  /** Unique id used to detect "is this the track currently loaded". */
  id: string
  /** 'live' streams report no duration and cannot be seeked. */
  kind: 'live' | 'sound'
  url: string
  title: string
  subtitle?: string
  href?: string
  artworkUrl?: string | null
  /** Duration supplied by an embed provider, used to advance the shared queue. */
  durationSec?: number | null
  /** A 'live'-kind stream that's actually playing pre-recorded rotation right
   * now, nobody's on air — mini-player shows "REPLAY" instead of "LIVE". */
  isReplay?: boolean
  /** Set on 'live' tracks so the listen-heartbeat effect can identify which
   * channel to attribute minutes to — 'sound' tracks don't need this, the
   * server resolves the channel from the archive item id instead. */
  channelSlug?: string
  /** Set when this track has no locally-hosted audio at all — playback lives
   * entirely inside a third-party embed widget (see player-embed-plugins/).
   * `url` is meaningless when this is set (leave it ''); load() skips every
   * native <audio>/HLS step, and transport methods (togglePlay/seek/seekBy)
   * become no-ops, since there's no control channel into the embed's iframe. */
  embed?: PlayerEmbedSource
}

export interface PlayerState {
  track: PlayerTrack | null
  playing: boolean
  buffering: boolean
  /** A fatal hls.js error or a native <audio> error fired for the current track —
   * the stream genuinely isn't playable right now, as opposed to normal buffering. */
  error: boolean
  currentTime: number
  duration: number
  volume: number
  muted: boolean
  /** Real quality of the currently-playing HLS rendition (e.g. "FLAC", "192 kbps"),
   * reported by hls.js once it picks a level — null until then or for non-HLS tracks. */
  streamQuality: string | null
}

export interface PlayerContextValue extends PlayerState {
  audioRef: RefObject<HTMLAudioElement>
  /** Single shared analyser node connected to the playing audio, for visualizers. */
  analyser: AnalyserNode | null
  /** Per-channel analysers (split before any downmixing) for stereo level meters. */
  analyserL: AnalyserNode | null
  analyserR: AnalyserNode | null
  load: (track: PlayerTrack, opts?: { autoplay?: boolean; queue?: PlayerTrack[] }) => void
  togglePlay: () => void | Promise<void>
  seek: (ratio: number) => void
  /** Relative seek in seconds (e.g. -10 / +10 for keyboard shortcuts); no-op on live streams. */
  seekBy: (deltaSeconds: number) => void
  /** Jumps to the next track in queue — wraps to the start only if repeat is on. */
  playNext: () => void
  /** Jumps to the previous track in queue, wrapping to the end. */
  playPrevious: () => void
  close: () => void
  /** The full ordered playlist the current track belongs to (includes the current track). */
  queue: PlayerTrack[]
  /** Tracks that will play after the current one, in order. */
  upNext: PlayerTrack[]
  /** Previously played tracks, most recent first. */
  history: PlayerTrack[]
  /** When the queue reaches its end: loop back to the start, instead of stopping. */
  repeat: boolean
  toggleRepeat: () => void
  /** When on, next/ended picks a random other track instead of sequential order. */
  shuffle: boolean
  toggleShuffle: () => void
  /** Appends to the queue — starts one from the current track if none exists yet. */
  addToQueue: (track: PlayerTrack) => boolean
  /** Bumps by 1 every time addToQueue actually adds something (not on a no-op
   * duplicate) — the queue-toggle button in mini-player.tsx watches this to
   * flash regardless of which page/button triggered the add. */
  queueFlashSignal: number
  removeFromQueue: (trackId: string) => void
  /** Drops every not-yet-played track, keeping only the one currently loaded. */
  clearQueue: () => void
  /** Replaces the not-yet-played portion of the queue with a new order (drag-reorder). */
  reorderUpNext: (newUpNext: PlayerTrack[]) => void
  setVolume: (v: number) => void
  toggleMute: () => void
  /** Patch title/subtitle/artwork on the currently loaded track without reload
   * (e.g. Tahti Radio rotation handoff keeps the same HLS URL). */
  updateTrackMeta: (
    patch: Partial<Pick<PlayerTrack, 'title' | 'subtitle' | 'artworkUrl' | 'href'>>,
  ) => void
}
