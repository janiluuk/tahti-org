// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useRef, useState } from 'react'

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

// Loads Hls.js from CDN on first use, then initialises the audio element.
// Falls back to native HLS for Safari which supports it natively.
export default function HlsPlayer({
  url,
  onAudioMount,
}: {
  url: string
  onAudioMount?: (el: HTMLAudioElement) => void
}) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [buffering, setBuffering] = useState(false)

  useEffect(() => {
    if (audioRef.current && onAudioMount) onAudioMount(audioRef.current)
  }, [onAudioMount])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onWaiting = () => setBuffering(true)
    const onPlaying = () => setBuffering(false)
    const onCanPlay = () => setBuffering(false)
    audio.addEventListener('waiting', onWaiting)
    audio.addEventListener('playing', onPlaying)
    audio.addEventListener('canplay', onCanPlay)

    // Safari: native HLS support
    if (audio.canPlayType('application/vnd.apple.mpegurl')) {
      audio.src = url
      return
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
    } else {
      // Dynamically inject the CDN script once
      if (!document.getElementById('hls-js-cdn')) {
        const script = document.createElement('script')
        script.id = 'hls-js-cdn'
        script.src = 'https://cdn.jsdelivr.net/npm/hls.js@1.5.15/dist/hls.min.js'
        script.onload = init
        document.head.appendChild(script)
      } else {
        // Script tag exists but hasn't fired onload yet — wait a tick
        const t = setInterval(() => {
          if (window.Hls) {
            clearInterval(t)
            init()
          }
        }, 50)
        return () => clearInterval(t)
      }
    }

    return () => {
      audio.removeEventListener('waiting', onWaiting)
      audio.removeEventListener('playing', onPlaying)
      audio.removeEventListener('canplay', onCanPlay)
      hls?.destroy()
    }
  }, [url])

  return (
    <div>
      {buffering && (
        <p role="status" aria-live="polite" className="ch-player-buffering">
          Buffering live stream…
        </p>
      )}
      <audio
        ref={audioRef}
        controls
        className="ch-player-audio"
        aria-label="Live stream player"
        data-testid="channel-live-player"
      />
    </div>
  )
}
