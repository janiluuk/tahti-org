// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/** Static per-set waveform overview rendered from server-extracted [0..255] amplitude buckets. */
export function ArchiveWaveform({ peaks }: { peaks: number[] | null | undefined }) {
  if (!peaks || peaks.length === 0) return null

  return (
    <div className="ch-archive-waveform" aria-hidden="true">
      {peaks.map((peak, i) => (
        <span
          key={i}
          className="ch-archive-wf-bar"
          style={{ ['--h' as string]: `${Math.max(4, Math.round((peak / 255) * 100))}%` }}
        />
      ))}
    </div>
  )
}
