// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { WaveformPlayer } from '@tahti/ui'

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

export default function HlsPlayer({
  url,
  onAudioMount,
}: {
  url: string
  onAudioMount?: (el: HTMLAudioElement) => void
}) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [buffering, setBuffering] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    if (audioRef.current && onAudioMount) onAudioMount(audioRef.current)
  }, [onAudioMount])

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

  const handleSeek = useCallback((ratio: number) => {
    const audio = audioRef.current
    if (!audio || !Number.isFinite(audio.duration)) return
    audio.currentTime = ratio * audio.duration
  }, [])

  const isLive = !Number.isFinite(duration) || duration === 0
  const formatBadge = url.toLowerCase().includes('flac') ? 'FLAC' : 'HLS'

  return (
    <div className="ch-player-card">
      <audio
        ref={audioRef}
        className="ch-player-audio-hidden"
        aria-label="Live stream player"
        data-testid="channel-live-player"
      />
      <WaveformPlayer
        embedded
        playing={playing}
        buffering={buffering}
        isLive={isLive}
        currentTime={currentTime}
        duration={duration}
        formatBadge={formatBadge}
        onTogglePlay={togglePlay}
        onSeek={isLive ? undefined : handleSeek}
      />
    </div>
  )
}
