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
  DEFAULT_LIVE_STREAM_QUALITY,
  MUTED_STORAGE_KEY,
  VOLUME_STORAGE_KEY,
  qualityLabelForBitrate,
  readStoredMuted,
  readStoredVolume,
} from './player-utils'
import { useListenHeartbeat } from './use-listen-heartbeat'
import { usePlayerAnalyser } from './use-player-analyser'
import { usePlayerDocumentTitle } from './use-player-document-title'
import { usePlayerKeyboard } from './use-player-keyboard'

const HISTORY_LIMIT = 50

const PlayerContext = createContext<PlayerContextValue | null>(null)

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const hlsRef = useRef<HlsInstance | null>(null)
  const currentTrackIdRef = useRef<string | null>(null)
  /** Full previous track object (currentTrackIdRef only keeps the id) — needed to
   * archive it into history the moment load() switches to a different track. */
  const currentTrackRef = useRef<PlayerTrack | null>(null)
  /** The ordered list the current track belongs to, for auto-advance + loop on 'ended'.
   * Mirrored into `queue` state below for rendering — this ref is what `onEnded` reads,
   * since its listener closure would otherwise see a stale queue. */
  const queueRef = useRef<PlayerTrack[] | null>(null)
  const repeatRef = useRef(false)
  const shuffleRef = useRef(false)
  /** Track ids already advanced past while shuffle is on — so random next drains the
   * playlist before wrapping (only when repeat is also on). */
  const shufflePlayedRef = useRef<Set<string>>(new Set())
  /** The live stream that was playing right before the listener diverted to play a
   * one-off track (e.g. a single archive track while Radio was on) — so playback
   * can hand back to it once that track ends, instead of just going silent. Cleared
   * once consumed, when the listener explicitly starts a different live stream, or
   * on close(). */
  const radioResumeRef = useRef<PlayerTrack | null>(null)
  const embedTimerRef = useRef<number | null>(null)
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
  const [queue, setQueue] = useState<PlayerTrack[]>([])
  const [queueFlashSignal, setQueueFlashSignal] = useState(0)
  const [history, setHistory] = useState<PlayerTrack[]>([])
  const [repeat, setRepeat] = useState(false)
  const [shuffle, setShuffle] = useState(false)
  const { analyser, analyserL, analyserR } = usePlayerAnalyser(audioRef)

  const teardownHls = useCallback(() => {
    hlsRef.current?.destroy()
    hlsRef.current = null
  }, [])

  const load = useCallback(
    (track: PlayerTrack, opts?: { autoplay?: boolean; queue?: PlayerTrack[] }) => {
      const audio = audioRef.current
      if (!audio) return

      const nextQueue = opts?.queue ?? null
      const prevQueueIds = (queueRef.current ?? []).map((t) => t.id).join('\0')
      const nextQueueIds = (nextQueue ?? []).map((t) => t.id).join('\0')
      queueRef.current = nextQueue
      setQueue(nextQueue ?? [])
      // New playlist identity — restart the shuffle drain so random next can visit
      // every track before wrapping again.
      if (prevQueueIds !== nextQueueIds) {
        shufflePlayedRef.current = new Set()
      }

      if (currentTrackIdRef.current === track.id) {
        if (opts?.autoplay !== false) {
          audio.play().catch((e) => console.warn('[player] play() rejected', e))
        }
        return
      }

      const prevTrack = currentTrackRef.current
      if (embedTimerRef.current != null) {
        window.clearTimeout(embedTimerRef.current)
        embedTimerRef.current = null
      }
      // Recorded the moment a track STARTS, not when it's superseded — otherwise a
      // session that only ever plays one track (e.g. tunes into radio and leaves it
      // running) never gets an entry, since nothing ever displaces it to trigger the
      // old "archive prevTrack on switch" write. Later re-loads of the same track just
      // dedupe back to the top instead of piling up duplicates.
      setHistory((h) => [track, ...h.filter((t) => t.id !== track.id)].slice(0, HISTORY_LIMIT))
      // Diverting from a live stream to a one-off track — remember the stream so
      // onEnded can hand playback back to it. Starting a live stream directly (the
      // listener picked a new one on purpose) clears any stale resume target.
      if (prevTrack && prevTrack.kind === 'live' && track.kind !== 'live') {
        radioResumeRef.current = prevTrack
      } else if (track.kind === 'live') {
        radioResumeRef.current = null
      }
      currentTrackIdRef.current = track.id
      currentTrackRef.current = track

      setState((prev) => ({
        ...prev,
        track,
        playing: false,
        buffering: false,
        error: false,
        currentTime: 0,
        duration: 0,
        streamQuality: null,
      }))

      teardownHls()

      // Embed tracks (hearthis.at, etc.) have no file for the shared <audio>
      // element to play — silence it so a previous native track doesn't keep
      // running underneath the embed widget, and skip straight past the HLS/
      // native-audio branches below. `playing` is set optimistically off the
      // requested autoplay intent, since there's no <audio> 'play'/'pause'
      // event to derive it from for an embed track.
      if (track.embed) {
        audio.pause()
        audio.removeAttribute('src')
        audio.load()
        const autoplay = opts?.autoplay !== false
        setState((prev) => ({
          ...prev,
          playing: autoplay,
          duration: track.durationSec ?? 0,
        }))
        return
      }

      const playWhenReady = () => {
        if (opts?.autoplay !== false) {
          audio.play().catch((e) => console.warn('[player] play() rejected', e))
        }
      }

      // 'live' tracks are usually an HLS (.m3u8) playlist, but can also be a plain
      // audio file standing in for a stream (e.g. a looping demo track) — only take
      // the hls.js path for an actual playlist URL.
      const isHlsUrl = track.url.split(/[#?]/)[0]!.toLowerCase().endsWith('.m3u8')
      // A 'live' track that isn't an HLS playlist is a stand-in file for a stream
      // (e.g. a demo loop) — it should never audibly "end". Set unconditionally so
      // switching away from such a track doesn't leave loop=true behind on the
      // shared <audio> element.
      audio.loop = track.kind === 'live' && !isHlsUrl

      if (
        track.kind === 'live' &&
        isHlsUrl &&
        !audio.canPlayType('application/vnd.apple.mpegurl')
      ) {
        const init = () => {
          const Hls = window.Hls
          if (Hls?.isSupported()) {
            // hls.js defaults liveDurationInfinity to false, which sets the
            // MediaSource's actual duration to "end of the last fragment"
            // instead of Infinity for a live stream — confirmed live in
            // production: Firefox reported audio.duration as the buffered
            // window size (~16s) instead of Infinity/NaN like Chromium,
            // which made the UI think this open-ended stream was a short,
            // finite, seekable track once currentTime caught up to it, and
            // caused real MSE stalling/rebuffering as more segments arrived
            // past that stale ceiling. This is hls.js's own documented flag
            // for exactly this case, not a workaround.
            const hls = new Hls({ liveDurationInfinity: true })
            hlsRef.current = hls
            hls.on(Hls.Events.ERROR, (_event, data) => {
              console.error('[player] hls.js error', data.type, data.details, data)
              if (data.fatal) setState((prev) => ({ ...prev, error: true, buffering: false }))
            })
            hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
              const bitrate = hls.levels[data.level]?.bitrate
              if (!bitrate) return
              setState((prev) => ({ ...prev, streamQuality: qualityLabelForBitrate(bitrate) }))
            })
            setState((prev) => ({ ...prev, streamQuality: DEFAULT_LIVE_STREAM_QUALITY }))
            hls.loadSource(track.url)
            hls.attachMedia(audio)
            playWhenReady()
          }
        }
        ensureHlsScriptLoading(init)
      } else {
        // Safari plays the .m3u8 natively (no hls.js, so no LEVEL_SWITCHED to
        // report a measured bitrate) — same fixed 192kbps rendition applies.
        if (track.kind === 'live' && isHlsUrl) {
          setState((prev) => ({ ...prev, streamQuality: DEFAULT_LIVE_STREAM_QUALITY }))
        }
        audio.src = track.url
        audio.load()
        playWhenReady()
      }
    },
    [teardownHls],
  )

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

  /** Returns whether it actually advanced to another track — onEnded uses this to
   * know whether to fall back to radioResumeRef instead of just going silent. */
  const playNext = useCallback((): boolean => {
    const q = queueRef.current
    const currentId = currentTrackIdRef.current
    if (!q || q.length < 2 || !currentId) return false
    const idx = q.findIndex((t) => t.id === currentId)
    if (idx === -1) return false

    if (shuffleRef.current) {
      shufflePlayedRef.current.add(currentId)
      const others = q.filter((t) => t.id !== currentId)
      const unplayed = others.filter((t) => !shufflePlayedRef.current.has(t.id))
      let pool = unplayed
      if (pool.length === 0) {
        if (!repeatRef.current) return false
        shufflePlayedRef.current = new Set([currentId])
        pool = others
      }
      const next = pool[Math.floor(Math.random() * pool.length)]!
      load(next, { autoplay: true, queue: q })
      return true
    }

    const isLast = idx === q.length - 1
    if (isLast && !repeatRef.current) return false
    load(q[(idx + 1) % q.length]!, { autoplay: true, queue: q })
    return true
  }, [load])

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

  const playPrevious = useCallback(() => {
    const q = queueRef.current
    const currentId = currentTrackIdRef.current
    if (!q || q.length < 2 || !currentId) return
    const idx = q.findIndex((t) => t.id === currentId)
    if (idx === -1) return
    const prevIdx = idx === 0 ? q.length - 1 : idx - 1
    load(q[prevIdx]!, { autoplay: true, queue: q })
  }, [load])

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
    queueRef.current = null
    radioResumeRef.current = null
    shufflePlayedRef.current = new Set()
    setQueue([])
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
  }, [teardownHls])

  const toggleRepeat = useCallback(() => {
    setRepeat((prev) => !prev)
  }, [])

  const toggleShuffle = useCallback(() => {
    setShuffle((prev) => {
      const next = !prev
      if (next) {
        shufflePlayedRef.current = new Set(
          currentTrackIdRef.current ? [currentTrackIdRef.current] : [],
        )
        // Shuffle the visible Up Next order so the queue panel matches random mode.
        const base = queueRef.current
        if (base && base.length > 1) {
          const currentIdx = base.findIndex((t) => t.id === currentTrackIdRef.current)
          const head = currentIdx === -1 ? [] : base.slice(0, currentIdx + 1)
          const rest = currentIdx === -1 ? [...base] : base.slice(currentIdx + 1)
          for (let i = rest.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1))
            ;[rest[i], rest[j]] = [rest[j]!, rest[i]!]
          }
          const reordered = [...head, ...rest]
          queueRef.current = reordered
          setQueue(reordered)
        }
      } else {
        shufflePlayedRef.current = new Set()
      }
      return next
    })
  }, [])

  const clearQueue = useCallback(() => {
    const current = currentTrackRef.current
    const next = current ? [current] : []
    queueRef.current = next
    setQueue(next)
  }, [])

  const reorderUpNext = useCallback((newUpNext: PlayerTrack[]) => {
    const base = queueRef.current
    if (!base) return
    const currentIdx = base.findIndex((t) => t.id === currentTrackIdRef.current)
    const head = currentIdx === -1 ? base : base.slice(0, currentIdx + 1)
    const next = [...head, ...newUpNext]
    queueRef.current = next
    setQueue(next)
  }, [])

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

  // Kept in sync so onEnded's listener closure (registered once, below) always reads
  // the current value rather than the one captured when the listener was attached.
  useEffect(() => {
    repeatRef.current = repeat
  }, [repeat])

  useEffect(() => {
    shuffleRef.current = shuffle
  }, [shuffle])

  useListenHeartbeat({
    track: state.track,
    playing: state.playing,
    currentTime: state.currentTime,
    duration: state.duration,
    pathname,
  })

  /** Appends to the queue — starts one from the current track if none exists yet. */
  const addToQueue = useCallback(
    (track: PlayerTrack) => {
      const base = queueRef.current ?? (state.track ? [state.track] : [])
      if (base.some((t) => t.id === track.id)) return false
      const next = [...base, track]
      queueRef.current = next
      setQueue(next)
      setQueueFlashSignal((n) => n + 1)
      return true
    },
    [state.track],
  )

  const removeFromQueue = useCallback((trackId: string) => {
    const base = queueRef.current
    if (!base) return
    const next = base.filter((t) => t.id !== trackId)
    queueRef.current = next
    setQueue(next)
  }, [])

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

  const upNext = useMemo(() => {
    if (!state.track) return queue
    const idx = queue.findIndex((t) => t.id === state.track!.id)
    return idx === -1 ? queue : queue.slice(idx + 1)
  }, [queue, state.track])

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
