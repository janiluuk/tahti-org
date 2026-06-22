// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import type { VisualPreset, ColorScheme } from '@tahti/shared'
import { DEFAULT_COLOR_SCHEME, resolveColorScheme } from '@tahti/shared'

// Lazy-load each preset to keep the initial bundle small.
// Each preset uses Three.js which is large.
const WaveformBars = dynamic(
  () => import('./waveform-bars-preset').then((m) => ({ default: m.WaveformBarsPreset })),
  { ssr: false },
)
const ParticleField = dynamic(
  () => import('./particle-field-preset').then((m) => ({ default: m.ParticleFieldPreset })),
  { ssr: false },
)
const Aurora = dynamic(() => import('./aurora-preset').then((m) => ({ default: m.AuroraPreset })), {
  ssr: false,
})
const ReactiveGrid = dynamic(
  () => import('./reactive-grid-preset').then((m) => ({ default: m.ReactiveGridPreset })),
  { ssr: false },
)

interface Props {
  preset: VisualPreset
  colorSchemeJson?: string | null
  paletteJson?: string | null
  analyser?: AnalyserNode | null
  className?: string
}

function supportsWebGL(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    return !!(canvas.getContext('webgl2') ?? canvas.getContext('webgl'))
  } catch {
    return false
  }
}

export function ChannelVisualizer({
  preset,
  colorSchemeJson,
  paletteJson,
  analyser,
  className,
}: Props) {
  // window-dependent checks (WebGL support, prefers-reduced-motion) can only run on the
  // client, and SSR always renders nothing — so defer them to after mount. Otherwise the
  // client's first render diverges from the server-rendered HTML and React throws a
  // hydration mismatch.
  const [canRender, setCanRender] = useState(false)
  useEffect(() => {
    setCanRender(!window.matchMedia('(prefers-reduced-motion: reduce)').matches && supportsWebGL())
  }, [])

  if (preset === 'MINIMAL' || !canRender) return null

  const colorScheme: ColorScheme =
    resolveColorScheme(colorSchemeJson, paletteJson) ?? DEFAULT_COLOR_SCHEME

  const props = { colorScheme, analyser }

  return (
    <div
      className={className}
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 0,
      }}
      aria-hidden
    >
      {preset === 'WAVEFORM_BARS' && <WaveformBars {...props} />}
      {preset === 'PARTICLE_FIELD' && <ParticleField {...props} />}
      {preset === 'AURORA' && <Aurora {...props} />}
      {preset === 'REACTIVE_GRID' && <ReactiveGrid {...props} />}
    </div>
  )
}
