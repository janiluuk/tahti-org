// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_BASE ?? ''

type TargetType = 'ARCHIVE_ITEM' | 'RELEASE' | 'CHANNEL' | 'COLLECTION'

const REASONS: { value: string; label: string }[] = [
  { value: 'COPYRIGHT', label: 'Copyright infringement' },
  { value: 'HARASSMENT', label: 'Harassment or abuse' },
  { value: 'SPAM', label: 'Spam' },
  { value: 'ILLEGAL_CONTENT', label: 'Illegal content' },
  { value: 'OTHER', label: 'Other' },
]

/** No account required to report, matching the platform's anonymous-by-default listener model. */
export function ReportButton({
  targetType,
  targetId,
}: {
  targetType: TargetType
  targetId: string
}) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('COPYRIGHT')
  const [details, setDetails] = useState('')
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setPending(true)
    setError(null)
    try {
      const res = await fetch(`${apiUrl}/api/v1/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType,
          targetId,
          reason,
          details: details.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        setError(data.error ?? 'Could not submit report')
        return
      }
      setDone(true)
    } finally {
      setPending(false)
    }
  }

  if (done) {
    return <p className="report-button__done">Report received — thank you.</p>
  }

  if (!open) {
    return (
      <button type="button" className="report-button__trigger" onClick={() => setOpen(true)}>
        Report
      </button>
    )
  }

  return (
    <div className="report-button__form" role="form" aria-label="Report content">
      <select value={reason} onChange={(e) => setReason(e.target.value)}>
        {REASONS.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>
      <textarea
        placeholder="Details (optional)"
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        maxLength={2000}
        rows={2}
      />
      <div className="report-button__actions">
        <button type="button" disabled={pending} onClick={() => void submit()}>
          {pending ? 'Sending…' : 'Submit report'}
        </button>
        <button type="button" onClick={() => setOpen(false)} disabled={pending}>
          Cancel
        </button>
      </div>
      {error ? <p className="report-button__error">{error}</p> : null}
    </div>
  )
}
