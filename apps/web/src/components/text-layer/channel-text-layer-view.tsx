// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import type { ChannelTextLayerAlignment, ChannelTextLayerMode } from '@tahti/shared'
import { isActiveTextLayer } from '@tahti/shared'
import { LayeredWave3DText } from './layered-wave-3d-text'
import './text-layer.css'

const MODE_CLASS: Record<Exclude<ChannelTextLayerMode, 'NONE' | 'LAYERED_WAVE_3D'>, string> = {
  GRADIENT_SHIMMER: 'text-layer--gradient-shimmer',
  COSMIC_NEON: 'text-layer--cosmic-neon',
  SHIMMER_LINES: 'text-layer--shimmer-lines',
  GHOST_ECHO: 'text-layer--ghost-echo',
}

function alignClass(align: ChannelTextLayerAlignment): string {
  if (align === 'LEFT') return 'text-layer--left'
  if (align === 'RIGHT') return 'text-layer--right'
  return 'text-layer--center'
}

export function ChannelTextLayerView({
  mode,
  text,
  align,
}: {
  mode: ChannelTextLayerMode
  text: string
  align: ChannelTextLayerAlignment
}) {
  if (!isActiveTextLayer({ textLayerMode: mode, textLayerText: text })) return null

  if (mode === 'LAYERED_WAVE_3D') {
    return <LayeredWave3DText text={text} align={align} />
  }

  const effectClass = MODE_CLASS[mode as keyof typeof MODE_CLASS]
  if (!effectClass) return null

  return (
    <div
      className={`text-layer ${effectClass} ${alignClass(align)}`}
      aria-label="Channel text layer"
    >
      <h2 className="text-layer__heading">{text}</h2>
    </div>
  )
}

export { LayeredWave3DText }
