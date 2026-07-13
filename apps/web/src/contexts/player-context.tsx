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

interface HlsInstance {
  loadSource(url: string): void
  attachMedia(el: HTMLAudioElement): void
  destroy(): void
}

interface HlsConstructor {
  new (): HlsInstance
  isSupported(): boolean
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
}

interface PlayerState {
  track: PlayerTrack | null
  playing: boolean
  buffering: boolean
  currentTime: number
  duration: number
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
  close: () => void
}

const PlayerContext = createContext<PlayerContextValue | null>(null)

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const hlsRef = useRef<HlsInstance | null>(null)
  const currentTrackIdRef = useRef<string | null>(null)
  /** The ordered list the current track belongs to, for auto-advance + loop on 'ended'. */
  const queueRef = useRef<PlayerTrack[] | null>(null)
  const [state, setState] = useState<PlayerState>({
    track: null,
    playing: false,
    buffering: false,
    currentTime: 0,
    duration: 0,
  })
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

      queueRef.current = opts?.queue ?? null

      if (currentTrackIdRef.current === track.id) {
        if (opts?.autoplay !== false) void audio.play()
        return
      }
      currentTrackIdRef.current = track.id

      setState({ track, playing: false, buffering: false, currentTime: 0, duration: 0 })

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
            const hls = new Hls()
            hlsRef.current = hls
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

  const close = useCallback(() => {
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
    }
    teardownHls()
    currentTrackIdRef.current = null
    setState({ track: null, playing: false, buffering: false, currentTime: 0, duration: 0 })
  }, [teardownHls])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onWaiting = () => setState((prev) => ({ ...prev, buffering: true }))
    const onPlaying = () => setState((prev) => ({ ...prev, buffering: false, playing: true }))
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
      const queue = queueRef.current
      const currentId = currentTrackIdRef.current
      if (!queue || queue.length < 2 || !currentId) return
      const idx = queue.findIndex((t) => t.id === currentId)
      if (idx === -1) return
      // Wraps to index 0 after the last track — auto-advance, then loop.
      load(queue[(idx + 1) % queue.length]!, { autoplay: true, queue })
    }

    audio.addEventListener('waiting', onWaiting)
    audio.addEventListener('playing', onPlaying)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('canplay', onCanPlay)
    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('durationchange', onDurationChange)
    audio.addEventListener('ended', onEnded)

    return () => {
      audio.removeEventListener('waiting', onWaiting)
      audio.removeEventListener('playing', onPlaying)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('canplay', onCanPlay)
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('durationchange', onDurationChange)
      audio.removeEventListener('ended', onEnded)
    }
  }, [load])

  useEffect(() => () => teardownHls(), [teardownHls])

  const value = useMemo<PlayerContextValue>(
    () => ({ ...state, audioRef, analyser, analyserL, analyserR, load, togglePlay, seek, close }),
    [state, analyser, analyserL, analyserR, load, togglePlay, seek, close],
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
      <audio ref={audioRef} className="tahti-shared-audio" data-testid={testId} />
    </PlayerContext.Provider>
  )
}

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext)
  if (!ctx) throw new Error('usePlayer must be used within a PlayerProvider')
  return ctx
}
