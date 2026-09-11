'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { usePathname } from 'next/navigation'
import { ensureHlsScriptLoading, type HlsInstance } from './player-hls'
import type { PlayerContextValue, PlayerState, PlayerTrack } from './player-types'
import {
  MUTED_STORAGE_KEY,
  VOLUME_STORAGE_KEY,
  readStoredMuted,
  readStoredVolume,
} from './player-utils'
import { useListenHeartbeat } from './use-listen-heartbeat'
import { usePlayerAnalyser } from './use-player-analyser'
import { usePlayerDocumentTitle } from './use-player-document-title'
import { usePlayerKeyboard } from './use-player-keyboard'
import { usePlayerLoad, useTeardownHls } from './use-player-load'
import { usePlayerQueue } from './use-player-queue'

const HISTORY_LIMIT = 50

const PlayerContext = createContext<PlayerContextValue | null>(null)

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const hlsRef = useRef<HlsInstance | null>(null)
  const currentTrackIdRef = useRef<string | null>(null)
  /** Full previous track object (currentTrackIdRef only keeps the id) — needed to
   * archive it into history the moment load() switches to a different track. */
  const currentTrackRef = useRef<PlayerTrack | null>(null)
  /** The live stream that was playing right before the listener diverted to play a
   * one-off track (e.g. a single archive track while Radio was on) — so playback
   * can hand back to it once that track ends, instead of just going silent. Cleared
   * once consumed, when the listener explicitly starts a different live stream, or
   * on close(). */
  const radioResumeRef = useRef<PlayerTrack | null>(null)
  const embedTimerRef = useRef<number | null>(null)
  const loadRef = useRef<
    (track: PlayerTrack, opts?: { autoplay?: boolean; queue?: PlayerTrack[] }) => void
  >(() => {})
  const pathname = usePathname()
  const [state, setState] = useState<PlayerState>({
    track: null,
    playing: false,
    buffering: false,
    error: false,
    currentTime: 0,
    duration: 0,
    volume: 1,
    muted: false,
    streamQuality: null,
  })

  // Read persisted volume/mute after mount (SSR-safe: window isn't available server-side).
  useEffect(() => {
    setState((prev) => ({ ...prev, volume: readStoredVolume(), muted: readStoredMuted() }))
  }, [])

  // Preload hls.js as soon as the app mounts, rather than waiting for the
  // first live-track play click. Fetching it eagerly means window.Hls is
  // already set by the time a listener actually clicks play, so load()'s
  // init() below can call audio.play() synchronously within that click
  // instead of racing an async <script onload> — a delayed play() call like
  // that falls outside the click's user-gesture context and is silently
  // blocked by the browser's autoplay policy, which is why the very first
  // live/radio play of a session previously needed two clicks (the second
  // one succeeding because the script had finished loading by then).
  useEffect(() => {
    ensureHlsScriptLoading()
  }, [])

  const { analyser, analyserL, analyserR } = usePlayerAnalyser(audioRef)

  const getLoad = useCallback(() => loadRef.current, [])

  const {
    queue,
    setQueue,
    queueFlashSignal,
    history,
    setHistory,
    repeat,
    shuffle,
    queueRef,
    shufflePlayedRef,
    playNext,
    playPrevious,
    toggleRepeat,
    toggleShuffle,
    addToQueue,
    removeFromQueue,
    clearQueue,
    reorderUpNext,
    resetQueueState,
    upNext,
  } = usePlayerQueue({
    getLoad,
    currentTrack: state.track,
    currentTrackIdRef,
    currentTrackRef,
  })

  const teardownHls = useTeardownHls(hlsRef)

  const { load } = usePlayerLoad({
    audioRef,
    hlsRef,
    currentTrackIdRef,
    currentTrackRef,
    queueRef,
    shufflePlayedRef,
    radioResumeRef,
    embedTimerRef,
    setState,
    setQueue,
    setHistory,
    teardownHls,
  })

  loadRef.current = load

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current
    if (!audio || !state.track) return
    // No control channel into an embed widget's iframe — see PlayerTrack.embed.
    if (state.track.embed) return
    if (audio.paused) {
      await audio.play()
    } else {
      audio.pause()
    }
  }, [state.track])

  const seek = useCallback((ratio: number) => {
    const audio = audioRef.current
    if (!audio || !Number.isFinite(audio.duration)) return
    audio.currentTime = ratio * audio.duration
  }, [])

  /** Relative seek (keyboard shortcuts) — clamped to the track bounds; a no-op
   * on live streams, which report no duration and can't be seeked. */
  const seekBy = useCallback((deltaSeconds: number) => {
    const audio = audioRef.current
    if (!audio || !Number.isFinite(audio.duration)) return
    audio.currentTime = Math.min(audio.duration, Math.max(0, audio.currentTime + deltaSeconds))
  }, [])

  // Hearthis owns playback inside a cross-origin iframe, so it cannot emit the
  // native audio element's `ended` event. Use its known duration to preserve
  // the shared player's automatic queue advance.
  useEffect(() => {
    if (!state.track?.embed || !state.playing || !state.duration || state.duration <= 0) {
      if (embedTimerRef.current != null) {
        window.clearTimeout(embedTimerRef.current)
        embedTimerRef.current = null
      }
      return
    }
    embedTimerRef.current = window.setTimeout(() => {
      embedTimerRef.current = null
      setState((prev) => ({ ...prev, playing: false, currentTime: 0 }))
      const advanced = playNext()
      if (!advanced && radioResumeRef.current) {
        const resumeTrack = radioResumeRef.current
        radioResumeRef.current = null
        load(resumeTrack, { autoplay: true })
      }
    }, state.duration * 1000)
    return () => {
      if (embedTimerRef.current != null) {
        window.clearTimeout(embedTimerRef.current)
        embedTimerRef.current = null
      }
    }
  }, [load, playNext, state.duration, state.playing, state.track])

  const close = useCallback(() => {
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
    }
    teardownHls()
    if (embedTimerRef.current != null) {
      window.clearTimeout(embedTimerRef.current)
      embedTimerRef.current = null
    }
    const prevTrack = currentTrackRef.current
    if (prevTrack) {
      setHistory((h) =>
        [prevTrack, ...h.filter((t) => t.id !== prevTrack.id)].slice(0, HISTORY_LIMIT),
      )
    }
    currentTrackIdRef.current = null
    currentTrackRef.current = null
    radioResumeRef.current = null
    resetQueueState()
    setState((prev) => ({
      ...prev,
      track: null,
      playing: false,
      buffering: false,
      error: false,
      currentTime: 0,
      duration: 0,
      streamQuality: null,
    }))
  }, [resetQueueState, setHistory, teardownHls])

  const setVolume = useCallback((v: number) => {
    const clamped = Math.min(1, Math.max(0, v))
    setState((prev) => ({ ...prev, volume: clamped, muted: clamped === 0 ? prev.muted : false }))
  }, [])

  const toggleMute = useCallback(() => {
    setState((prev) => ({ ...prev, muted: !prev.muted }))
  }, [])

  const updateTrackMeta = useCallback(
    (patch: Partial<Pick<PlayerTrack, 'title' | 'subtitle' | 'artworkUrl' | 'href'>>) => {
      const current = currentTrackRef.current
      if (!current) return
      const next = { ...current, ...patch }
      if (
        next.title === current.title &&
        next.subtitle === current.subtitle &&
        next.artworkUrl === current.artworkUrl &&
        next.href === current.href
      ) {
        return
      }
      currentTrackRef.current = next
      setState((prev) => (prev.track ? { ...prev, track: next } : prev))
    },
    [],
  )

  // Keep the shared <audio> element's actual volume/muted in sync, and persist
  // across page loads — a new track load doesn't reset the audio element, but
  // the browser default volume (1) needs setting explicitly on first mount.
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.volume = state.volume
    audio.muted = state.muted
    window.localStorage.setItem(VOLUME_STORAGE_KEY, String(state.volume))
    window.localStorage.setItem(MUTED_STORAGE_KEY, state.muted ? '1' : '0')
  }, [state.volume, state.muted])

  usePlayerDocumentTitle({ track: state.track, playing: state.playing })

  usePlayerKeyboard({
    track: state.track,
    volume: state.volume,
    togglePlay,
    seekBy,
    playNext,
    playPrevious,
    setVolume,
    toggleMute,
  })

  useListenHeartbeat({
    track: state.track,
    playing: state.playing,
    currentTime: state.currentTime,
    duration: state.duration,
    pathname,
  })

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onError = () => {
      console.error('[player] audio element error', audio.error?.code, audio.error?.message)
      setState((prev) => ({ ...prev, error: true, buffering: false }))
    }
    const onWaiting = () => setState((prev) => ({ ...prev, buffering: true }))
    const onPlaying = () =>
      setState((prev) => ({ ...prev, buffering: false, playing: true, error: false }))
    const onPlay = () => setState((prev) => ({ ...prev, playing: true }))
    const onPause = () => setState((prev) => ({ ...prev, playing: false }))
    const onCanPlay = () => setState((prev) => ({ ...prev, buffering: false }))
    // The context value below is memoized on `state` as a whole, so every
    // setState here recreates it and re-renders every usePlayer() consumer
    // app-wide — including ones that never read currentTime at all (e.g.
    // RadioPlayerSection, which only destructures analyser/track). Browsers
    // fire native timeupdate far more often than any progress UI needs
    // (commonly much faster than 4/sec) — while radio plays practically
    // 100% of the time on that page, this was forcing continuous, high-
    // frequency re-renders of the whole player-adjacent tree, visualizer
    // included. 4 updates/sec is still smooth for a progress bar/waveform.
    //
    // Live streams (radio included — hls-player.tsx hardcodes kind: 'live')
    // never actually display this value: WaveformPlayer forces progress to 0
    // for isLive and shows liveElapsedSec or a bare "LIVE" label instead
    // (see WaveformPlayer.tsx). So for live playback, currentTime state has
    // no visual consumer at all — skip the update entirely rather than just
    // throttling it, cutting radio's continuous re-render rate to zero
    // instead of 4/sec.
    let lastTimeUpdateAt = 0
    const onTimeUpdate = () => {
      if (currentTrackRef.current?.kind === 'live') return
      const now = performance.now()
      if (now - lastTimeUpdateAt < 250) return
      lastTimeUpdateAt = now
      setState((prev) => ({ ...prev, currentTime: audio.currentTime }))
    }
    const onDurationChange = () =>
      setState((prev) => ({
        ...prev,
        duration: Number.isFinite(audio.duration) ? audio.duration : 0,
      }))
    const onEnded = () => {
      setState((prev) => ({ ...prev, playing: false, currentTime: 0 }))
      const advanced = playNext()
      if (!advanced && radioResumeRef.current) {
        const resumeTrack = radioResumeRef.current
        radioResumeRef.current = null
        load(resumeTrack, { autoplay: true })
      }
    }

    audio.addEventListener('waiting', onWaiting)
    audio.addEventListener('playing', onPlaying)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('canplay', onCanPlay)
    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('durationchange', onDurationChange)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('error', onError)

    return () => {
      audio.removeEventListener('waiting', onWaiting)
      audio.removeEventListener('playing', onPlaying)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('canplay', onCanPlay)
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('durationchange', onDurationChange)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('error', onError)
    }
  }, [load, playNext])

  useEffect(() => () => teardownHls(), [teardownHls])

  const value = useMemo<PlayerContextValue>(
    () => ({
      ...state,
      audioRef,
      analyser,
      analyserL,
      analyserR,
      load,
      togglePlay,
      seek,
      seekBy,
      playNext,
      playPrevious,
      close,
      queue,
      upNext,
      history,
      repeat,
      toggleRepeat,
      shuffle,
      toggleShuffle,
      addToQueue,
      queueFlashSignal,
      removeFromQueue,
      clearQueue,
      reorderUpNext,
      setVolume,
      toggleMute,
      updateTrackMeta,
    }),
    [
      state,
      analyser,
      analyserL,
      analyserR,
      load,
      togglePlay,
      seek,
      seekBy,
      playNext,
      playPrevious,
      close,
      queue,
      upNext,
      history,
      repeat,
      toggleRepeat,
      shuffle,
      toggleShuffle,
      addToQueue,
      queueFlashSignal,
      removeFromQueue,
      clearQueue,
      reorderUpNext,
      setVolume,
      toggleMute,
      updateTrackMeta,
    ],
  )

  const testId =
    state.track?.kind === 'live'
      ? 'channel-live-player'
      : state.track?.kind === 'sound'
        ? 'channel-sound-player'
        : 'tahti-shared-audio'

  return (
    <PlayerContext.Provider value={value}>
      {children}
      <audio
        ref={audioRef}
        crossOrigin="anonymous"
        className="tahti-shared-audio"
        data-testid={testId}
      />
    </PlayerContext.Provider>
  )
}

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext)
  if (!ctx) throw new Error('usePlayer must be used within a PlayerProvider')
  return ctx
}

export type { PlayerTrack, PlayerContextValue } from './player-types'
