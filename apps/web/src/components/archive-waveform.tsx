// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import type { MouseEvent } from 'react'

/** Static per-set waveform overview rendered from server-extracted [0..255] amplitude buckets,
 * with an overlaid progress fill for the currently-loaded track and click-to-seek. */
export function ArchiveWaveform({
  peaks,
  progress = 0,
  onSeek,
}: {
  peaks: number[] | null | undefined
  /** Played fraction, 0..1. Omit for a track that isn't currently loaded. */
  progress?: number
  onSeek?: (ratio: number) => void
}) {
  if (!peaks || peaks.length === 0) return null

  const bars = peaks.map((peak, i) => (
    <span
      key={i}
      className="ch-archive-wf-bar"
      style={{ ['--h' as string]: `${Math.max(4, Math.round((peak / 255) * 100))}%` }}
    />
  ))

  function handleClick(e: MouseEvent<HTMLDivElement>) {
    if (!onSeek) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    onSeek(Math.min(1, Math.max(0, ratio)))
  }

  return (
    <div
      className="ch-archive-waveform"
      onClick={onSeek ? handleClick : undefined}
      role={onSeek ? 'slider' : undefined}
      aria-label={onSeek ? 'Seek' : undefined}
      aria-valuenow={onSeek ? Math.round(progress * 100) : undefined}
      aria-valuemin={onSeek ? 0 : undefined}
      aria-valuemax={onSeek ? 100 : undefined}
    >
      <div className="ch-archive-wf-bars" aria-hidden="true">
        {bars}
      </div>
      <div
        className="ch-archive-wf-progress"
        aria-hidden="true"
        style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }}
      >
        <div className="ch-archive-wf-bars">{bars}</div>
      </div>
    </div>
  )
}
