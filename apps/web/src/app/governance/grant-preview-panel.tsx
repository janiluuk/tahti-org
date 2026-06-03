// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import { fetchGrantPreview } from './grant-preview-actions'

interface GrantPreviewArtist {
  username: string
  displayName: string
  units: number
  amountCents: number
  anomalies: Array<{ code: string; message: string }>
}

export default function GrantPreviewPanel() {
  const year = new Date().getUTCFullYear() - 1
  const [forYear, setForYear] = useState(String(year))
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
    const result = await fetchGrantPreview(parseInt(forYear, 10))
    setLoading(false)
    if (result.error) {
      setError(result.error)
      setPreview(null)
      return
    }
    setPreview(result.preview ?? null)
  }

  return (
    <section
      style={{
        marginBottom: '2rem',
        padding: '1rem',
        background: '#f8fafc',
        borderRadius: 8,
        border: '1px solid #e2e8f0',
      }}
    >
      <h2 style={{ fontSize: '1rem', margin: '0 0 0.5rem' }}>Annual grant preview (board)</h2>
      <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.75rem' }}>
        Dry-run allocation with anomaly flags before running the real calculation.
      </p>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ fontSize: '0.9rem' }}>
          Fiscal year{' '}
          <input
            type="number"
            value={forYear}
            onChange={(e) => setForYear(e.target.value)}
            min={2020}
            max={2100}
            style={{ width: 80, marginLeft: 4, padding: '0.25rem' }}
          />
        </label>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          style={{
            padding: '0.4rem 0.9rem',
            background: '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            cursor: loading ? 'wait' : 'pointer',
          }}
        >
          {loading ? 'Loading…' : 'Preview'}
        </button>
      </div>
      {error && (
        <p style={{ color: '#dc2626', marginTop: '0.5rem', fontSize: '0.9rem' }}>{error}</p>
      )}
      {preview && (
        <div style={{ marginTop: '1rem', fontSize: '0.9rem' }}>
          <p>
            Pool €{(preview.poolCents / 100).toLocaleString('fi-FI')} · {preview.totalUnits} units ·{' '}
            {preview.grantCount} recipients
            {preview.alreadyRun && (
              <strong style={{ color: '#b45309' }}>
                {' '}
                — grants already disbursed for this year
              </strong>
            )}
          </p>
          {preview.artists.length === 0 ? (
            <p style={{ color: '#888' }}>No qualifying artists.</p>
          ) : (
            <table style={{ width: '100%', marginTop: '0.5rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>
                  <th style={{ padding: '0.35rem' }}>Artist</th>
                  <th>Units</th>
                  <th>Grant</th>
                  <th>Flags</th>
                </tr>
              </thead>
              <tbody>
                {preview.artists.map((a) => (
                  <tr key={a.username} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '0.35rem' }}>{a.displayName}</td>
                    <td>{a.units}</td>
                    <td>€{(a.amountCents / 100).toFixed(2)}</td>
                    <td style={{ color: a.anomalies.length ? '#b45309' : '#888' }}>
                      {a.anomalies.length ? a.anomalies.map((x) => x.code).join(', ') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </section>
  )
}
