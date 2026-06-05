// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'
import type { TracklistEntry } from '@tahti/shared'

function formatTs(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export function TracklistView({ entries }: { entries: TracklistEntry[] }) {
  if (!entries?.length) return null

  return (
    <ol className="ch-tracklist">
      {entries.map((row, i) => (
        <li key={`${row.startSec}-${i}`} className="ch-tracklist-item">
          <span className="ch-tracklist-time">{formatTs(row.startSec)}</span>
          <span>
            <span className="ch-tracklist-title">{row.title}</span>
            {(row.artist || row.artistUsername) && (
              <span className="ch-tracklist-artist">
                {' '}
                —{' '}
                {row.artistUsername ? (
                  <Link href={`/u/${row.artistUsername}`}>@{row.artistUsername}</Link>
                ) : (
                  row.artist
                )}
              </span>
            )}
          </span>
        </li>
      ))}
    </ol>
  )
}
