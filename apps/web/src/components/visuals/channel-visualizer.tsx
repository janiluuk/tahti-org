// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { memo, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import type { VisualPreset, ColorScheme, VisualPresetSettings } from '@tahti/shared'
import {
  DEFAULT_COLOR_SCHEME,
  DEFAULT_VISUAL_PRESET_SETTINGS,
  resolveColorScheme,
} from '@tahti/shared'

// Lazy-load each preset to keep the initial bundle small.
// Each preset uses Three.js which is large.
const WaterRipple = dynamic(
  () => import('./water-ripple-preset').then((m) => ({ default: m.WaterRipplePreset })),
  { ssr: false },
)
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
const Cloudscape = dynamic(
  () => import('./cloudscape-preset').then((m) => ({ default: m.CloudscapePreset })),
  { ssr: false },
)
const LineTangle = dynamic(
  () => import('./line-tangle-preset').then((m) => ({ default: m.LineTanglePreset })),
  { ssr: false },
)
const BackdropBox = dynamic(
  () => import('./backdrop-box-preset').then((m) => ({ default: m.BackdropBoxPreset })),
  { ssr: false },
)
const LensFlares = dynamic(
  () => import('./lens-flares-preset').then((m) => ({ default: m.LensFlaresPreset })),
  { ssr: false },
)
const IesSpotlight = dynamic(
  () => import('./ies-spotlight-preset').then((m) => ({ default: m.IesSpotlightPreset })),
  { ssr: false },
)

interface Props {
  preset: VisualPreset
  colorSchemeJson?: string | null
  paletteJson?: string | null
  analyser?: AnalyserNode | null
  settings?: VisualPresetSettings | null
  className?: string
  /** Cover/background image — only WATER_RIPPLE uses this today. */
  artworkUrl?: string | null
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

function ChannelVisualizerImpl({
  preset,
  colorSchemeJson,
  paletteJson,
  analyser,
  settings,
  className,
  artworkUrl,
}: Props) {
  // window-dependent checks (WebGL support, prefers-reduced-motion) can only run on the
  // client, and SSR always renders nothing — so defer them to after mount. Otherwise the
  // client's first render diverges from the server-rendered HTML and React throws a
  // hydration mismatch.
  const [canRender, setCanRender] = useState(false)
  const settingsRef = useRef<VisualPresetSettings>(settings ?? DEFAULT_VISUAL_PRESET_SETTINGS)
  settingsRef.current = settings ?? DEFAULT_VISUAL_PRESET_SETTINGS

  useEffect(() => {
    setCanRender(!window.matchMedia('(prefers-reduced-motion: reduce)').matches && supportsWebGL())
  }, [])

  if (preset === 'MINIMAL' || !canRender) return null

  const colorScheme: ColorScheme =
    resolveColorScheme(colorSchemeJson, paletteJson) ?? DEFAULT_COLOR_SCHEME

  // Per-preset "React to audio" toggle (VisualPresetSettings.audioReactive) — withholding the
  // analyser here, in the one place all ten presets funnel through, makes the toggle apply
  // uniformly without each preset needing to check it itself.
  const effectiveAnalyser = settingsRef.current.audioReactive === false ? null : analyser
  const props = { colorScheme, analyser: effectiveAnalyser, settingsRef, artworkUrl }

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
      {preset === 'WATER_RIPPLE' && <WaterRipple {...props} />}
      {preset === 'WAVEFORM_BARS' && <WaveformBars {...props} />}
      {preset === 'PARTICLE_FIELD' && <ParticleField {...props} />}
      {preset === 'AURORA' && <Aurora {...props} />}
      {preset === 'REACTIVE_GRID' && <ReactiveGrid {...props} />}
      {preset === 'CLOUDSCAPE' && <Cloudscape {...props} />}
      {preset === 'LINE_TANGLE' && <LineTangle {...props} />}
      {preset === 'BACKDROP_BOX' && <BackdropBox {...props} />}
      {preset === 'LENS_FLARES' && <LensFlares {...props} />}
      {preset === 'IES_SPOTLIGHT' && <IesSpotlight {...props} />}
    </div>
  )
}

// The radio page's player re-renders on its own ticks (a 1s live-elapsed
// clock, a periodic now-playing poll) with every other prop here holding a
// stable reference — memoizing skips re-invoking this (and the heavy Three.js
// preset tree beneath it) on renders that don't actually change what it draws.
export const ChannelVisualizer = memo(ChannelVisualizerImpl)
