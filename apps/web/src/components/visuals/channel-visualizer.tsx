// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

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
const Aurora = dynamic(
  () => import('./aurora-preset').then((m) => ({ default: m.AuroraPreset })),
  { ssr: false },
)
const ReactiveGrid = dynamic(
  () => import('./reactive-grid-preset').then((m) => ({ default: m.ReactiveGridPreset })),
  { ssr: false },
)

interface Props {
  preset: VisualPreset
  colorSchemeJson?: string | null
  paletteJson?: string | null
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

export function ChannelVisualizer({ preset, colorSchemeJson, paletteJson, className }: Props) {
  if (preset === 'MINIMAL') return null

  const colorScheme: ColorScheme = resolveColorScheme(colorSchemeJson, paletteJson) ?? DEFAULT_COLOR_SCHEME

  // Respect prefers-reduced-motion
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return null
  }

  if (!supportsWebGL()) return null

  const props = { colorScheme }

  return (
    <div
      className={className}
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}
      aria-hidden
    >
      {preset === 'WAVEFORM_BARS' && <WaveformBars {...props} />}
      {preset === 'PARTICLE_FIELD' && <ParticleField {...props} />}
      {preset === 'AURORA' && <Aurora {...props} />}
      {preset === 'REACTIVE_GRID' && <ReactiveGrid {...props} />}
    </div>
  )
}
