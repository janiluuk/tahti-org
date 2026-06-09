// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import { fetchGrantPreview } from './actions'

interface GrantPreviewArtist {
  username: string
  displayName: string
  units: number
  amountCents: number
  anomalies: Array<{ code: string; message: string }>
}

type Props = { year: number }

export function AdminGrantPreviewPanel({ year }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<{
    poolCents: number
    totalUnits: number
    grantCount: number
    alreadyRun: boolean
    artists: GrantPreviewArtist[]
  } | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    const result = await fetchGrantPreview(year)
    setLoading(false)
    if (result.error) {
      setError(result.error)
      setPreview(null)
      return
    }
    setPreview(result.preview ?? null)
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
        <button className="admin-btn" onClick={load} disabled={loading}>
          {loading ? 'Loading preview…' : preview ? 'Refresh preview' : 'Load preview (dry run)'}
        </button>
        {preview && (
          <span style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>
            Pool €{(preview.poolCents / 100).toLocaleString('fi-FI')} · {preview.totalUnits} units ·{' '}
            {preview.grantCount} recipients
            {preview.alreadyRun && (
              <span style={{ color: 'var(--amber)' }}> — already disbursed</span>
            )}
          </span>
        )}
      </div>

      {error && <p style={{ color: 'var(--coral)', fontSize: '0.875rem' }}>Error: {error}</p>}

      {preview && preview.artists.length > 0 && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Artist</th>
                <th className="num">Units</th>
                <th className="num">Grant</th>
                <th>Flags</th>
              </tr>
            </thead>
            <tbody>
              {preview.artists.map((a) => (
                <tr key={a.username}>
                  <td>
                    <a href={`/u/${a.username}`} className="admin-inline-link">
                      {a.displayName}
                    </a>{' '}
                    <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>@{a.username}</span>
                  </td>
                  <td className="num">{a.units.toLocaleString()}</td>
                  <td className="num">€{(a.amountCents / 100).toFixed(2)}</td>
                  <td style={{ color: a.anomalies.length ? 'var(--amber)' : 'var(--muted)' }}>
                    {a.anomalies.length ? a.anomalies.map((x) => x.code).join(', ') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {preview && preview.artists.length === 0 && (
        <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>
          No qualifying artists for {year}.
        </p>
      )}
    </div>
  )
}
