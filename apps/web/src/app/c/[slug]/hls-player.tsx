// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

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

function fmtTime(secs: number): string {
  if (!isFinite(secs) || secs < 0) return '0:00'
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

// Waveform bars — 28 bars with staggered CSS animation heights
const BAR_HEIGHTS = [
  8, 14, 22, 30, 18, 26, 34, 20, 12, 28, 36, 24, 16, 30, 22, 18, 32, 14, 26, 20, 16, 28, 38, 22, 18,
  14, 26, 20,
]

export default function HlsPlayer({
  url,
  onAudioMount,
}: {
  url: string
  onAudioMount?: (el: HTMLAudioElement) => void
}) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)
  const [playing, setPlaying] = useState(false)
  const [buffering, setBuffering] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  // Expose audio element to parent (for BgCanvas audio reactivity)
  useEffect(() => {
    if (audioRef.current && onAudioMount) onAudioMount(audioRef.current)
  }, [onAudioMount])

  // HLS setup
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onWaiting = () => setBuffering(true)
    const onPlaying = () => {
      setBuffering(false)
      setPlaying(true)
    }
    const onPause = () => setPlaying(false)
    const onCanPlay = () => setBuffering(false)
    const onTimeUpdate = () => setCurrentTime(audio.currentTime)
    const onDurationChange = () => setDuration(audio.duration)

    audio.addEventListener('waiting', onWaiting)
    audio.addEventListener('playing', onPlaying)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('canplay', onCanPlay)
    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('durationchange', onDurationChange)

    if (audio.canPlayType('application/vnd.apple.mpegurl')) {
      audio.src = url
      return () => {
        audio.removeEventListener('waiting', onWaiting)
        audio.removeEventListener('playing', onPlaying)
        audio.removeEventListener('pause', onPause)
        audio.removeEventListener('canplay', onCanPlay)
        audio.removeEventListener('timeupdate', onTimeUpdate)
        audio.removeEventListener('durationchange', onDurationChange)
      }
    }

    let hls: HlsInstance | null = null
    function init() {
      if (!audio) return
      const Hls = window.Hls
      if (Hls?.isSupported()) {
        hls = new Hls()
        hls.loadSource(url)
        hls.attachMedia(audio)
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
      return () => {
        clearInterval(t)
        audio.removeEventListener('waiting', onWaiting)
        audio.removeEventListener('playing', onPlaying)
        audio.removeEventListener('pause', onPause)
        audio.removeEventListener('canplay', onCanPlay)
        audio.removeEventListener('timeupdate', onTimeUpdate)
        audio.removeEventListener('durationchange', onDurationChange)
      }
    }

    return () => {
      audio.removeEventListener('waiting', onWaiting)
      audio.removeEventListener('playing', onPlaying)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('canplay', onCanPlay)
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('durationchange', onDurationChange)
      hls?.destroy()
    }
  }, [url])

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      await audio.play()
    } else {
      audio.pause()
    }
  }, [])

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current
    const bar = progressRef.current
    if (!audio || !bar || !isFinite(audio.duration)) return
    const { left, width } = bar.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - left) / width))
    audio.currentTime = ratio * audio.duration
  }, [])

  const isLive = !isFinite(duration) || duration === 0
  const progress = isLive ? 0 : duration > 0 ? currentTime / duration : 0

  return (
    <div className="ch-player-card">
      {/* Hidden native audio element — managed by HLS.js */}
      <audio
        ref={audioRef}
        className="ch-player-audio-hidden"
        aria-label="Live stream player"
        data-testid="channel-live-player"
      />

      {/* Status row */}
      <div className="ch-player-status">
        <span className={`ch-player-status-dot${playing ? ' ch-player-status-dot--live' : ''}`} />
        <span className="ch-player-status-label">
          {buffering ? 'Buffering…' : playing ? 'Live stream' : 'Ready to play'}
        </span>
        <span className="ch-player-badge">
          {url.toLowerCase().includes('flac') ? 'FLAC' : 'HLS'}
        </span>
      </div>

      {/* Waveform */}
      <div className="ch-waveform" aria-hidden="true">
        {BAR_HEIGHTS.map((h, i) => (
          <div
            key={i}
            className={`ch-wf-bar${playing ? ' ch-wf-bar--active' : ''}`}
            style={
              {
                '--h': `${h}px`,
                '--delay': `${(i * 0.05).toFixed(2)}s`,
                '--dur': `${0.6 + (i % 7) * 0.1}s`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      {/* Controls row */}
      <div className="ch-player-controls">
        <button
          type="button"
          className={`ch-play-btn${buffering ? ' ch-play-btn--buffering' : ''}`}
          onClick={togglePlay}
          aria-label={playing ? 'Pause' : 'Play live stream'}
        >
          {buffering ? (
            <span className="ch-play-spinner" />
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

        <div className="ch-player-progress-wrap">
          <span className="ch-player-time">{isLive ? 'LIVE' : fmtTime(currentTime)}</span>
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
          <div
            ref={progressRef}
            className="ch-progress-bar"
            onClick={handleSeek}
            title={isLive ? 'Live stream' : 'Seek'}
          >
            <div className="ch-progress-fill" style={{ width: `${progress * 100}%` }} />
            {!isLive && (
              <div className="ch-progress-thumb" style={{ left: `${progress * 100}%` }} />
            )}
          </div>
          {!isLive && <span className="ch-player-time">{fmtTime(duration)}</span>}
        </div>
      </div>
    </div>
  )
}
