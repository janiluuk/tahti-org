// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useState } from 'react'

/** Connects an audio element to an AnalyserNode for visualizer presets. */
export function useAudioAnalyser(
  audioEl: HTMLAudioElement | null,
  enabled: boolean,
): AnalyserNode | null {
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null)

  useEffect(() => {
    if (!audioEl || !enabled) {
      setAnalyser(null)
      return
    }

    let ctx: AudioContext | null = null
    try {
      ctx = new AudioContext()
      const source = ctx.createMediaElementSource(audioEl)
      const node = ctx.createAnalyser()
      node.fftSize = 256
      node.smoothingTimeConstant = 0.75
      source.connect(node)
      node.connect(ctx.destination)
      setAnalyser(node)
    } catch {
      setAnalyser(null)
    }

    return () => {
      setAnalyser(null)
      void ctx?.close()
    }
  }, [audioEl, enabled])

  return analyser
}
