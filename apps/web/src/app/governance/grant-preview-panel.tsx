// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import { Alert, Button, ButtonIcon, Field, Heading, Input, Text } from '@tahti/ui'
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
    <section className="brand-callout-panel">
      <Heading level={2}>Annual grant preview (board)</Heading>
      <Text size="sm" tone="muted">
        Dry-run allocation with anomaly flags before running the real calculation.
      </Text>
      <div className="brand-form-row">
        <Field label="Fiscal year" htmlFor="grant-preview-year">
          <Input
            id="grant-preview-year"
            type="number"
            value={forYear}
            onChange={(e) => setForYear(e.target.value)}
            min={2020}
            max={2100}
          />
        </Field>
        <Button type="button" variant="primary" size="sm" onClick={load} disabled={loading}>
          <ButtonIcon name="search" />
          {loading ? 'Loading…' : 'Preview'}
        </Button>
      </div>
      {error && <Alert variant="error">{error}</Alert>}
      {preview && (
        <div className="brand-section">
          <Text size="sm">
            Pool €{(preview.poolCents / 100).toLocaleString('fi-FI')} · {preview.totalUnits} units ·{' '}
            {preview.grantCount} recipients
            {preview.alreadyRun && (
              <>
                {' '}
                <span className="warn">— grants already disbursed for this year</span>
              </>
            )}
          </Text>
          {preview.artists.length === 0 ? (
            <Text tone="muted" size="sm">
              No qualifying artists.
            </Text>
          ) : (
            <div className="brand-table-wrap">
              <table className="brand-table">
                <thead>
                  <tr>
                    <th>Artist</th>
                    <th>Units</th>
                    <th>Grant</th>
                    <th>Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.artists.map((a) => (
                    <tr key={a.username}>
                      <td>{a.displayName}</td>
                      <td>{a.units}</td>
                      <td>€{(a.amountCents / 100).toFixed(2)}</td>
                      <td className={a.anomalies.length ? 'warn' : 'brand-muted'}>
                        {a.anomalies.length ? a.anomalies.map((x) => x.code).join(', ') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
