// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import { generateAnnualReport } from '../../actions'

export function AnnualReportGenerator() {
  const year = new Date().getFullYear() - 1
  const [selectedYear, setSelectedYear] = useState(String(year))
  const [preview, setPreview] = useState<string | null>(null)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onGenerate() {
    setPending(true)
    setMsg(null)
    const { error, markdown, downloadUrl: url } = await generateAnnualReport(selectedYear)
    setPending(false)
    if (error) {
      setMsg(error)
      return
    }
    setPreview(markdown ?? null)
    setDownloadUrl(url ?? null)
    setMsg('Report saved to MinIO')
  }

  return (
    <section className="admin-card" style={{ marginBottom: '1.5rem' }}>
      <h2>Generate annual report</h2>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem' }}>
        <label>
          Year{' '}
          <input
            type="number"
            min={2020}
            max={2100}
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
          />
        </label>
        <button type="button" className="admin-btn" disabled={pending} onClick={onGenerate}>
          {pending ? 'Assembling…' : 'Generate & save'}
        </button>
      </div>
      {msg ? <p className="admin-stat-sub">{msg}</p> : null}
      {downloadUrl ? (
        <p className="admin-stat-sub">
          <a href={downloadUrl} target="_blank" rel="noreferrer">
            Download Markdown
          </a>
        </p>
      ) : null}
      {preview ? (
        <pre
          style={{
            whiteSpace: 'pre-wrap',
            fontSize: '0.8rem',
            maxHeight: '24rem',
            overflow: 'auto',
            background: 'var(--card2)',
            padding: '1rem',
            borderRadius: '6px',
          }}
        >
          {preview}
        </pre>
      ) : null}
    </section>
  )
}
