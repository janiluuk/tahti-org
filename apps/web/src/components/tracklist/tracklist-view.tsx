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
    <ol
      style={{
        listStyle: 'none',
        padding: 0,
        margin: '0.75rem 0 0',
        fontSize: '0.9rem',
        borderTop: '1px solid #eee',
        paddingTop: '0.75rem',
      }}
    >
      {entries.map((row, i) => (
        <li
          key={`${row.startSec}-${i}`}
          style={{
            display: 'grid',
            gridTemplateColumns: '3.5rem 1fr',
            gap: '0.5rem',
            padding: '0.35rem 0',
          }}
        >
          <span style={{ fontFamily: 'monospace', color: '#888' }}>{formatTs(row.startSec)}</span>
          <span>
            <span style={{ fontWeight: 500 }}>{row.title}</span>
            {(row.artist || row.artistUsername) && (
              <span style={{ color: '#666' }}>
                {' '}
                —{' '}
                {row.artistUsername ? (
                  <Link href={`/u/${row.artistUsername}`} style={{ color: '#2563eb' }}>
                    @{row.artistUsername}
                  </Link>
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
