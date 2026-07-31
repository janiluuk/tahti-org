// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import type { ComponentType } from 'react'
import dynamic from 'next/dynamic'
import type { SlideshowPreset } from '@tahti/shared'
import type { SlideshowTransitionProps } from './types'

// Lazy-loaded like ChannelVisualizer's presets — each pulls in Three.js, which is large.
const ParticleDissolve = dynamic(
  () => import('./particle-dissolve').then((m) => ({ default: m.ParticleDissolveTransition })),
  { ssr: false },
)
const GlitchWipe = dynamic(
  () => import('./glitch-wipe').then((m) => ({ default: m.GlitchWipeTransition })),
  { ssr: false },
)
const CubeFlip = dynamic(
  () => import('./cube-flip').then((m) => ({ default: m.CubeFlipTransition })),
  { ssr: false },
)
const LiquidDistortion = dynamic(
  () => import('./liquid-distortion').then((m) => ({ default: m.LiquidDistortionTransition })),
  { ssr: false },
)

const COMPONENTS: Partial<Record<SlideshowPreset, ComponentType<SlideshowTransitionProps>>> = {
  PARTICLE_DISSOLVE: ParticleDissolve,
  GLITCH_WIPE: GlitchWipe,
  CUBE_FLIP: CubeFlip,
  LIQUID_DISTORTION: LiquidDistortion,
}

/** Renders the WebGL transition for a given slideshow preset, or null if the preset
 * isn't a WebGL one (caller should check WEBGL_SLIDESHOW_PRESETS first). */
export function WebglSlideshowTransition({
  preset,
  ...props
}: SlideshowTransitionProps & { preset: SlideshowPreset }) {
  const Component = COMPONENTS[preset]
  if (!Component) return null
  return <Component {...props} />
}
