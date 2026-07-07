// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@tahti/ui'
import { resolveContentReport } from '../actions'

export type ContentReportRow = {
  id: string
  targetType: 'ARCHIVE_ITEM' | 'RELEASE' | 'CHANNEL' | 'COLLECTION'
  targetId: string
  reason: 'COPYRIGHT' | 'HARASSMENT' | 'SPAM' | 'ILLEGAL_CONTENT' | 'OTHER'
  details: string | null
  status: 'OPEN' | 'REVIEWING' | 'ACTIONED' | 'DISMISSED'
  resolvedByDisplayName: string | null
  resolutionNote: string | null
  resolvedAt: string | null
  createdAt: string
}

function ReportRowActions({ report }: { report: ContentReportRow }) {
  const router = useRouter()
  const [note, setNote] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function resolve(status: 'REVIEWING' | 'ACTIONED' | 'DISMISSED') {
    setPending(true)
    setError(null)
    const res = await resolveContentReport(report.id, status, note.trim() || undefined)
    setPending(false)
    if (res.error) {
      setError(res.error)
      return
    }
    router.refresh()
  }

  if (report.status === 'ACTIONED' || report.status === 'DISMISSED') {
    return (
      <div className="admin-text-muted">
        {report.status === 'ACTIONED' ? 'Actioned' : 'Dismissed'}
        {report.resolvedByDisplayName ? ` by ${report.resolvedByDisplayName}` : ''}
        {report.resolutionNote ? <p>{report.resolutionNote}</p> : null}
      </div>
    )
  }

  return (
    <div className="admin-beta-approve-form">
      <input
        placeholder="Resolution note (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="admin-beta-action-row">
        {report.status === 'OPEN' ? (
          <Button disabled={pending} onClick={() => resolve('REVIEWING')} variant="secondary">
            Start review
          </Button>
        ) : null}
        <Button disabled={pending} onClick={() => resolve('ACTIONED')} variant="primary">
          {pending ? 'Saving…' : 'Mark actioned'}
        </Button>
        <Button disabled={pending} onClick={() => resolve('DISMISSED')} variant="ghost">
          Dismiss
        </Button>
      </div>
      {error ? <p className="admin-form-error">{error}</p> : null}
    </div>
  )
}

export function ContentReportsPanel({ reports }: { reports: ContentReportRow[] }) {
  if (reports.length === 0) {
    return <p className="admin-text-muted">No reports in this view.</p>
  }

  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Reported</th>
            <th>Target</th>
            <th>Reason</th>
            <th>Details</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {reports.map((r) => (
            <tr key={r.id}>
              <td>{new Date(r.createdAt).toLocaleString()}</td>
              <td>
                {r.targetType}
                <br />
                <span className="admin-text-muted">{r.targetId}</span>
              </td>
              <td>{r.reason}</td>
              <td>{r.details ?? '—'}</td>
              <td className={r.status === 'OPEN' ? 'admin-warn' : ''}>{r.status}</td>
              <td>
                <ReportRowActions report={r} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
