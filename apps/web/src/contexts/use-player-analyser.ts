'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>
import { useEffect, useState, type RefObject } from 'react'

/** Connect AnalyserNodes to the shared <audio> element once, on first playback —
 * createMediaElementSource can only be called once per element. Also splits the
 * source into per-channel analysers (before AnalyserNode's implicit downmix) so
 * stereo level meters (broadcast test-signal step) can show true L/R levels rather
 * than a single mixed reading. */
export function usePlayerAnalyser(audioRef: RefObject<HTMLAudioElement | null>) {
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null)
  const [analyserL, setAnalyserL] = useState<AnalyserNode | null>(null)
  const [analyserR, setAnalyserR] = useState<AnalyserNode | null>(null)

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
  }, [audioRef])

  return { analyser, analyserL, analyserR }
}
