// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useRef } from 'react'
import dynamic from 'next/dynamic'
import {
  DEFAULT_COLOR_SCHEME,
  DEFAULT_VISUAL_PRESET_SETTINGS,
  parseVisualSettingsMap,
  resolveColorScheme,
  resolveVisualPresetSettings,
  type BackgroundVisualPreset,
} from '@tahti/shared'
import { usePlayer } from '@/contexts/player-context'
import { useSuspendBackgroundCanvas } from '@/contexts/background-canvas-context'

const Bloom = dynamic(
  () => import('@/components/visuals/bloom-preset').then((m) => ({ default: m.BloomPreset })),
  { ssr: false },
)

/** The channel's idle ambient look (Backdrop tab, distinct from the header/
 * player VisualPreset which reacts to what's playing) — active while nothing
 * is playing, since ChannelPageVisualizer already covers the same surface
 * once a track starts. Both suspend the shared BgCanvas independently
 * (reference-counted), so there's never more than one WebGL scene running. */
export function ChannelBackdropVisualizer({
  enabled,
  preset,
  colorSchemeJson,
  settingsJson,
}: {
  enabled: boolean
  preset: BackgroundVisualPreset | null
  colorSchemeJson?: string | null
  settingsJson?: string | null
}) {
  const { analyser, playing } = usePlayer()
  const active = enabled && preset === 'BLOOM' && !playing
  useSuspendBackgroundCanvas(active)
  const settingsRef = useRef(DEFAULT_VISUAL_PRESET_SETTINGS)
  settingsRef.current = preset
    ? resolveVisualPresetSettings(parseVisualSettingsMap(settingsJson), preset)
    : DEFAULT_VISUAL_PRESET_SETTINGS
  if (!active) return null

  const colorScheme = resolveColorScheme(colorSchemeJson, null) ?? DEFAULT_COLOR_SCHEME

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 0,
      }}
      aria-hidden
    >
      <Bloom colorScheme={colorScheme} analyser={analyser} settingsRef={settingsRef} />
    </div>
  )
}
