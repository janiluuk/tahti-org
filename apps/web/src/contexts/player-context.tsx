// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

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

interface HlsErrorData {
  fatal: boolean
  type: string
  details: string
}

interface HlsInstance {
  loadSource(url: string): void
  attachMedia(el: HTMLAudioElement): void
  destroy(): void
  on(event: 'hlsError', callback: (event: 'hlsError', data: HlsErrorData) => void): void
}

interface HlsConfig {
  liveDurationInfinity?: boolean
}

interface HlsConstructor {
  new (config?: HlsConfig): HlsInstance
  isSupported(): boolean
  Events: { ERROR: 'hlsError' }
}

declare global {
  interface Window {
    Hls?: HlsConstructor
  }
}

export interface PlayerTrack {
  /** Unique id used to detect "is this the track currently loaded". */
  id: string
  /** 'live' streams report no duration and cannot be seeked. */
  kind: 'live' | 'archive'
  url: string
  title: string
  subtitle?: string
  href?: string
  artworkUrl?: string | null
  /** A 'live'-kind stream that's actually playing pre-recorded rotation right
   * now, nobody's on air — mini-player shows "REPLAY" instead of "LIVE". */
  isReplay?: boolean
}

interface PlayerState {
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
}

const VOLUME_STORAGE_KEY = 'tahti-player-volume'
const MUTED_STORAGE_KEY = 'tahti-player-muted'

function readStoredVolume(): number {
  if (typeof window === 'undefined') return 1
  const raw = window.localStorage.getItem(VOLUME_STORAGE_KEY)
  const parsed = raw != null ? Number(raw) : NaN
  return Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed)) : 1
}

function readStoredMuted(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(MUTED_STORAGE_KEY) === '1'
}

interface PlayerContextValue extends PlayerState {
  audioRef: React.RefObject<HTMLAudioElement>
  /** Single shared analyser node connected to the playing audio, for visualizers. */
  analyser: AnalyserNode | null
  /** Per-channel analysers (split before any downmixing) for stereo level meters. */
  analyserL: AnalyserNode | null
  analyserR: AnalyserNode | null
  load: (track: PlayerTrack, opts?: { autoplay?: boolean; queue?: PlayerTrack[] }) => void
  togglePlay: () => void | Promise<void>
  seek: (ratio: number) => void
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
  /** Appends to the queue — starts one from the current track if none exists yet. */
  addToQueue: (track: PlayerTrack) => void
  removeFromQueue: (trackId: string) => void
  /** Drops every not-yet-played track, keeping only the one currently loaded. */
  clearQueue: () => void
  /** Replaces the not-yet-played portion of the queue with a new order (drag-reorder). */
  reorderUpNext: (newUpNext: PlayerTrack[]) => void
  setVolume: (v: number) => void
  toggleMute: () => void
}

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
  const [state, setState] = useState<PlayerState>({
    track: null,
    playing: false,
    buffering: false,
    error: false,
    currentTime: 0,
    duration: 0,
    volume: 1,
    muted: false,
  })

  // Read persisted volume/mute after mount (SSR-safe: window isn't available server-side).
  useEffect(() => {
    setState((prev) => ({ ...prev, volume: readStoredVolume(), muted: readStoredMuted() }))
  }, [])
  const [queue, setQueue] = useState<PlayerTrack[]>([])
  const [history, setHistory] = useState<PlayerTrack[]>([])
  const [repeat, setRepeat] = useState(false)
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null)
  const [analyserL, setAnalyserL] = useState<AnalyserNode | null>(null)
  const [analyserR, setAnalyserR] = useState<AnalyserNode | null>(null)

  // Connect a single AnalyserNode to the shared <audio> element once, on first
  // playback — createMediaElementSource can only be called once per element.
  // Also split the source into per-channel analysers (before AnalyserNode's
  // implicit downmix) so stereo level meters (broadcast test-signal step) can
  // show true L/R levels rather than a single mixed reading.
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const init = () => {
      try {
        const ctx = new AudioContext()
        const node = ctx.createAnalyser()
        node.fftSize = 512
        node.smoothingTimeConstant = 0.8
        const source = ctx.createMediaElementSource(audio)
        source.connect(node)
        node.connect(ctx.destination)
        setAnalyser(node)

        const splitter = ctx.createChannelSplitter(2)
        const left = ctx.createAnalyser()
        const right = ctx.createAnalyser()
        left.fftSize = 1024
        right.fftSize = 1024
        left.smoothingTimeConstant = 0.4
        right.smoothingTimeConstant = 0.4
        source.connect(splitter)
        splitter.connect(left, 0)
        splitter.connect(right, 1)
        setAnalyserL(left)
        setAnalyserR(right)
      } catch (e) {
        console.warn('[player] analyser setup failed', e)
      }
    }

    audio.addEventListener('play', init, { once: true })
    return () => audio.removeEventListener('play', init)
  }, [])

  const teardownHls = useCallback(() => {
    hlsRef.current?.destroy()
    hlsRef.current = null
  }, [])

  const load = useCallback(
    (track: PlayerTrack, opts?: { autoplay?: boolean; queue?: PlayerTrack[] }) => {
      const audio = audioRef.current
      if (!audio) return

      const nextQueue = opts?.queue ?? null
      queueRef.current = nextQueue
      setQueue(nextQueue ?? [])

      if (currentTrackIdRef.current === track.id) {
        if (opts?.autoplay !== false) void audio.play()
        return
      }

      const prevTrack = currentTrackRef.current
      if (prevTrack && prevTrack.id !== track.id) {
        setHistory((h) => [prevTrack, ...h.filter((t) => t.id !== prevTrack.id)].slice(0, HISTORY_LIMIT))
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
      }))

      teardownHls()

      const playWhenReady = () => {
        if (opts?.autoplay !== false) void audio.play()
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
            hls.loadSource(track.url)
            hls.attachMedia(audio)
            playWhenReady()
          }
        }
        if (window.Hls) {
          init()
        } else if (!document.getElementById('hls-js-cdn')) {
          const script = document.createElement('script')
          script.id = 'hls-js-cdn'
          script.src = 'https://cdn.jsdelivr.net/npm/hls.js@1.5.15/dist/hls.min.js'
          script.onload = init
          document.head.appendChild(script)
        } else {
          const t = setInterval(() => {
            if (window.Hls) {
              clearInterval(t)
              init()
            }
          }, 50)
        }
      } else {
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

  const playNext = useCallback(() => {
    const q = queueRef.current
    const currentId = currentTrackIdRef.current
    if (!q || q.length < 2 || !currentId) return
    const idx = q.findIndex((t) => t.id === currentId)
    if (idx === -1) return
    const isLast = idx === q.length - 1
    if (isLast && !repeatRef.current) return
    load(q[(idx + 1) % q.length]!, { autoplay: true, queue: q })
  }, [load])

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
    const prevTrack = currentTrackRef.current
    if (prevTrack) {
      setHistory((h) => [prevTrack, ...h.filter((t) => t.id !== prevTrack.id)].slice(0, HISTORY_LIMIT))
    }
    currentTrackIdRef.current = null
    currentTrackRef.current = null
    queueRef.current = null
    setQueue([])
    setState((prev) => ({
      ...prev,
      track: null,
      playing: false,
      buffering: false,
      error: false,
      currentTime: 0,
      duration: 0,
    }))
  }, [teardownHls])

  const toggleRepeat = useCallback(() => {
    setRepeat((prev) => !prev)
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

  // Tab title reflects what's actually playing, so radio.tahti.live is
  // identifiable from a background tab — restored once nothing is loaded.
  useEffect(() => {
    const original = document.title
    if (state.track && state.playing) {
      document.title = state.track.subtitle
        ? `${state.track.title} — ${state.track.subtitle}`
        : state.track.title
    }
    return () => {
      document.title = original
    }
  }, [state.track, state.playing])

  // Kept in sync so onEnded's listener closure (registered once, below) always reads
  // the current value rather than the one captured when the listener was attached.
  useEffect(() => {
    repeatRef.current = repeat
  }, [repeat])

  /** Appends to the queue — starts one from the current track if none exists yet. */
  const addToQueue = useCallback(
    (track: PlayerTrack) => {
      const base = queueRef.current ?? (state.track ? [state.track] : [])
      if (base.some((t) => t.id === track.id)) return
      const next = [...base, track]
      queueRef.current = next
      setQueue(next)
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
    const onTimeUpdate = () => setState((prev) => ({ ...prev, currentTime: audio.currentTime }))
    const onDurationChange = () =>
      setState((prev) => ({
        ...prev,
        duration: Number.isFinite(audio.duration) ? audio.duration : 0,
      }))
    const onEnded = () => {
      setState((prev) => ({ ...prev, playing: false, currentTime: 0 }))
      playNext()
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
      playNext,
      playPrevious,
      close,
      queue,
      upNext,
      history,
      repeat,
      toggleRepeat,
      addToQueue,
      removeFromQueue,
      clearQueue,
      reorderUpNext,
      setVolume,
      toggleMute,
    }),
    [
      state,
      analyser,
      analyserL,
      analyserR,
      load,
      togglePlay,
      seek,
      playNext,
      playPrevious,
      close,
      queue,
      upNext,
      history,
      repeat,
      toggleRepeat,
      addToQueue,
      removeFromQueue,
      clearQueue,
      reorderUpNext,
      setVolume,
      toggleMute,
    ],
  )

  const testId =
    state.track?.kind === 'live'
      ? 'channel-live-player'
      : state.track?.kind === 'archive'
        ? 'channel-archive-player'
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
