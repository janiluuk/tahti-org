// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@tahti/ui'
import { generateFeatureRequestQuarterlyReport } from './actions'

export type FeatureRequestQuarterlyReportRow = {
  id: string
  year: number
  quarter: number
  generatedAt: string
  generatedByDisplayName: string
  downloadUrl: string | null
}

export function FeatureRequestsReports({
  reports,
}: {
  reports: FeatureRequestQuarterlyReportRow[]
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function generate() {
    setPending(true)
    setError(null)
    const res = await generateFeatureRequestQuarterlyReport()
    setPending(false)
    if (res.error) {
      setError(res.error)
      return
    }
    router.refresh()
  }

  return (
    <div>
      <Button variant="primary" size="sm" disabled={pending} onClick={generate}>
        {pending ? 'Generating…' : 'Generate this quarter’s review report'}
      </Button>
      {error ? <p className="admin-form-error">{error}</p> : null}

      {reports.length === 0 ? (
        <p className="admin-text-muted">No quarterly reports generated yet.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: '0.5rem 0 0' }}>
          {reports.map((r) => (
            <li key={r.id} className="admin-stat-sub">
              Q{r.quarter} {r.year} — generated {new Date(r.generatedAt).toLocaleDateString()} by{' '}
              {r.generatedByDisplayName}
              {r.downloadUrl && (
                <>
                  {' — '}
                  <a href={r.downloadUrl} target="_blank" rel="noreferrer">
                    download
                  </a>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
