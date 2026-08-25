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
import { isTypingTarget } from '../lib/is-typing-target'

interface HlsErrorData {
  fatal: boolean
  type: string
  details: string
}

interface HlsLevel {
  bitrate: number
}

interface HlsLevelSwitchedData {
  level: number
}

interface HlsInstance {
  loadSource(url: string): void
  attachMedia(el: HTMLAudioElement): void
  destroy(): void
  levels: HlsLevel[]
  on(event: 'hlsError', callback: (event: 'hlsError', data: HlsErrorData) => void): void
  on(
    event: 'hlsLevelSwitched',
    callback: (event: 'hlsLevelSwitched', data: HlsLevelSwitchedData) => void,
  ): void
}

interface HlsConfig {
  liveDurationInfinity?: boolean
}

interface HlsConstructor {
  new (config?: HlsConfig): HlsInstance
  isSupported(): boolean
  Events: { ERROR: 'hlsError'; LEVEL_SWITCHED: 'hlsLevelSwitched' }
}

/** The dual-bitrate HLS output (infra/liquidsoap-channel.liq.template) only ever
 * offers two renditions — 192kbps MP3 or lossless FLAC — so a bitrate well above
 * the MP3 rendition reliably means the FLAC one is playing. */
function qualityLabelForBitrate(bitrateBps: number): string {
  return bitrateBps >= 400_000 ? 'FLAC' : `${Math.round(bitrateBps / 1000)} kbps`
}

/** liveHlsManifestPath() always points hls.js straight at a single-rendition
 * MEDIA playlist (stream-mp3-192.m3u8) — there's no master playlist with
 * per-variant #EXT-X-STREAM-INF/BANDWIDTH tags for hls.js to read a real
 * bitrate from, so hls.levels[].bitrate is hls.js's own unmeasured guess and
 * reads as 0 right after a level switch. The manifest is always the 192kbps
 * MP3 rendition, so that's the honest default the instant playback starts;
 * a later LEVEL_SWITCHED with a genuinely-measured positive bitrate (e.g. if
 * a real multi-bitrate master playlist is ever introduced) can still refine it. */
const DEFAULT_LIVE_STREAM_QUALITY = '192 kbps'

declare global {
  interface Window {
    Hls?: HlsConstructor
  }
}

const HLS_JS_SRC = 'https://cdn.jsdelivr.net/npm/hls.js@1.5.15/dist/hls.min.js'
const HLS_JS_SCRIPT_ID = 'hls-js-cdn'

/** Kicks off (or reuses) the hls.js CDN fetch and runs `onLoad` once it's ready —
 * immediately if `window.Hls` is already set. Safe to call more than once
 * (e.g. once eagerly on mount, again from the first live-track play click);
 * later calls just attach another listener to the in-flight script tag rather
 * than re-fetching. */
function ensureHlsScriptLoading(onLoad?: () => void) {
  if (window.Hls) {
    onLoad?.()
    return
  }
  const existing = document.getElementById(HLS_JS_SCRIPT_ID) as HTMLScriptElement | null
  if (existing) {
    if (onLoad) existing.addEventListener('load', onLoad, { once: true })
    return
  }
  const script = document.createElement('script')
  script.id = HLS_JS_SCRIPT_ID
  script.src = HLS_JS_SRC
  if (onLoad) script.addEventListener('load', onLoad, { once: true })
  document.head.appendChild(script)
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
  /** Real quality of the currently-playing HLS rendition (e.g. "FLAC", "192 kbps"),
   * reported by hls.js once it picks a level — null until then or for non-HLS tracks. */
  streamQuality: string | null
}

const VOLUME_STORAGE_KEY = 'tahti-player-volume'
const MUTED_STORAGE_KEY = 'tahti-player-muted'
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

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
  /** Archive track ids a listen-event has already been recorded for this
   * session, so the threshold check below only ever fires once per track. */
  const recordedListenRef = useRef<Set<string>>(new Set())
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
        // 0.8 made the spectrum-analyzer visualizer look sluggish/laggy behind
        // the actual audio; 0.3 keeps it visually reactive without being jittery.
        node.smoothingTimeConstant = 0.3
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

  // Site-wide keyboard shortcuts for the player (space/arrows/M) — active from
  // any page once a track is loaded. Yields to typing targets, modifier-key
  // combos (Cmd/Ctrl/Alt stay reserved for the browser/OS), and any keydown a
  // more specific widget already consumed (e.g. the mixer knob, a menu).
  useEffect(() => {
    if (!state.track) return

    function onKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return
      if (isTypingTarget(e.target)) return

      switch (e.key) {
        case ' ':
          e.preventDefault()
          void togglePlay()
          break
        case 'ArrowRight':
          e.preventDefault()
          if (e.shiftKey) playNext()
          else seekBy(10)
          break
        case 'ArrowLeft':
          e.preventDefault()
          if (e.shiftKey) playPrevious()
          else seekBy(-10)
          break
        case 'ArrowUp':
          e.preventDefault()
          setVolume(state.volume + 0.05)
          break
        case 'ArrowDown':
          e.preventDefault()
          setVolume(state.volume - 0.05)
          break
        case 'm':
        case 'M':
          e.preventDefault()
          toggleMute()
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [state.track, state.volume, togglePlay, seekBy, playNext, playPrevious, setVolume, toggleMute])

  // Kept in sync so onEnded's listener closure (registered once, below) always reads
  // the current value rather than the one captured when the listener was attached.
  useEffect(() => {
    repeatRef.current = repeat
  }, [repeat])

  useEffect(() => {
    shuffleRef.current = shuffle
  }, [shuffle])

  // Counts a "listen" toward top-lists once a track has played long enough
  // to be a real listen (30s, or halfway through a shorter track) — fires
  // at most once per track per session; the API dedupes per listener/day too.
  useEffect(() => {
    const track = state.track
    if (!track || track.kind !== 'archive') return
    if (recordedListenRef.current.has(track.id)) return
    const threshold = state.duration > 0 ? Math.min(30, state.duration * 0.5) : 30
    if (state.currentTime < threshold) return
    recordedListenRef.current.add(track.id)
    fetch(`${API_URL}/api/listen-events`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archiveItemId: track.id }),
    }).catch(() => undefined)
  }, [state.track, state.currentTime, state.duration])

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
