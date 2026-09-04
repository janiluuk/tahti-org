// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useMemo, useState, type MouseEvent as ReactMouseEvent } from 'react'

export interface WaveformMarker {
  id: string
  /** Position along the track, 0..1. */
  ratio: number
  /** Reaction emoji rendered on the marker (❤️ 😂 😮 🙌). */
  emoji: string
}

function ratioFromClientX(clientX: number, rect: DOMRectReadOnly): number {
  return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
}

/** Static per-set waveform overview rendered from server-extracted [0..255] amplitude buckets,
 * with an overlaid progress fill for the currently-loaded track, click/drag-to-seek, and an
 * optional layer of subtly-animated reaction markers pinned to where listeners reacted. */
export function SoundWaveform({
  peaks,
  progress = 0,
  onSeek,
  accentColor,
  markers,
  size = 'default',
}: {
  peaks: number[] | null | undefined
  /** Played fraction, 0..1. Omit for a track that isn't currently loaded. */
  progress?: number
  onSeek?: (ratio: number) => void
  /** Artist's per-track color override — falls back to the design system's
   * default cyan when unset. */
  accentColor?: string | null
  markers?: WaveformMarker[]
  size?: 'default' | 'large'
}) {
  const [dragRatio, setDragRatio] = useState<number | null>(null)

  const bars = useMemo(
    () =>
      peaks?.map((peak, i) => (
        <span
          key={i}
          className="ch-sound-wf-bar"
          style={{ ['--h' as string]: `${Math.max(4, Math.round((peak / 255) * 100))}%` }}
        />
      )),
    [peaks],
  )

  if (!peaks || peaks.length === 0) return null

  const displayProgress = dragRatio ?? progress

  function handlePointerDown(e: ReactMouseEvent<HTMLDivElement>) {
    if (!onSeek) return
    const rect = e.currentTarget.getBoundingClientRect()
    setDragRatio(ratioFromClientX(e.clientX, rect))

    const handleMove = (ev: globalThis.MouseEvent) =>
      setDragRatio(ratioFromClientX(ev.clientX, rect))
    const handleUp = (ev: globalThis.MouseEvent) => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
      setDragRatio(null)
      onSeek(ratioFromClientX(ev.clientX, rect))
    }
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
  }

  return (
    <div
      className={`ch-sound-waveform${size === 'large' ? ' ch-sound-waveform--large' : ''}`}
      onMouseDown={onSeek ? handlePointerDown : undefined}
      role={onSeek ? 'slider' : undefined}
      aria-label={onSeek ? 'Seek' : undefined}
      aria-valuenow={onSeek ? Math.round(displayProgress * 100) : undefined}
      aria-valuemin={onSeek ? 0 : undefined}
      aria-valuemax={onSeek ? 100 : undefined}
      style={accentColor ? { ['--ch-wf-accent' as string]: accentColor } : undefined}
    >
      <div className="ch-sound-wf-bars" aria-hidden="true">
        {bars}
      </div>
      <div
        className="ch-sound-wf-progress"
        aria-hidden="true"
        style={{ width: `${Math.min(100, Math.max(0, displayProgress * 100))}%` }}
      >
        <div className="ch-sound-wf-bars">{bars}</div>
      </div>
      {markers && markers.length > 0 && (
        <div className="ch-sound-wf-markers" aria-hidden="true">
          {markers.map((m) => (
            <span
              key={m.id}
              className="ch-sound-wf-marker"
              style={{ left: `${Math.min(100, Math.max(0, m.ratio * 100))}%` }}
            >
              {m.emoji}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
