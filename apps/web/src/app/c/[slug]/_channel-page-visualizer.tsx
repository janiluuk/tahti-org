// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { usePlayer } from '@/contexts/player-context'
import { useSuspendBackgroundCanvas } from '@/contexts/background-canvas-context'
import { ChannelVisualizer } from '@/components/visuals/channel-visualizer'
import { resolveActiveTrackPreset } from '@/components/active-track-stage'
import type { VisualPreset, VisualPresetSettings } from '@tahti/shared'

/** Page-level ambient visualizer — reacts to the shared analyser while anything
 * is playing so the current track lights up the whole channel surface. */
export function ChannelPageVisualizer({
  preset,
  colorSchemeJson,
  settings,
}: {
  preset: VisualPreset
  colorSchemeJson?: string | null
  settings?: VisualPresetSettings | null
}) {
  const { analyser, playing } = usePlayer()
  const resolved = playing ? resolveActiveTrackPreset(preset) : preset
  const active = resolved !== 'MINIMAL'
  // This covers the same viewport as the shared background canvas (BgCanvas) —
  // no point running two full WebGL scenes when only one is ever visible.
  useSuspendBackgroundCanvas(active)
  if (!active) return null

  return (
    <ChannelVisualizer
      preset={resolved}
      colorSchemeJson={colorSchemeJson}
      settings={settings}
      analyser={playing ? analyser : null}
      className={`ch-page-visualizer${playing ? ' ch-page-visualizer--live' : ''}`}
    />
  )
}
