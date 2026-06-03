// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useRef } from 'react'

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
export default function HlsPlayer({ url }: { url: string }) {
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

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
      hls?.destroy()
    }
  }, [url])

  return <audio ref={audioRef} controls style={{ width: '100%' }} aria-label="Live stream player" />
}
