// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import { requestAccountDeletion } from './privacy-actions'

export default function PrivacyPanel({ username, apiUrl }: { username: string; apiUrl: string }) {
  const [reason, setReason] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onDeletionRequest(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    setMsg(null)
    const { error, ticketId } = await requestAccountDeletion(reason.trim())
    setPending(false)
    if (error) {
      setMsg(error)
      return
    }
    setMsg(`Deletion request submitted (ticket #${ticketId}). The board will follow up by email.`)
    setReason('')
  }

  return (
    <section className="db-panel">
      <h2>Privacy &amp; data</h2>
      <p className="db-panel-sub">
        Export your data or request account deletion under GDPR. Deletion is reviewed manually
        within 30 days.
      </p>
      <ul className="db-link-list">
        <li>
          <a href={`${apiUrl}/api/me/data-export.json`}>Download data export (JSON)</a>
        </li>
        <li>
          <a href={`${apiUrl}/api/me/press-kit.json`}>Download press kit (JSON)</a>
        </li>
        <li>
          <a
            href={`${apiUrl}/api/v1/u/${encodeURIComponent(username)}/press-kit.json`}
            target="_blank"
            rel="noreferrer"
          >
            Public press kit URL
          </a>
        </li>
      </ul>
      <form onSubmit={onDeletionRequest} style={{ marginTop: '1rem' }}>
        <label>
          Request account deletion
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            required
            maxLength={2000}
            placeholder="Brief reason (optional context for the board)"
          />
        </label>
        <button type="submit" disabled={pending || !reason.trim()}>
          {pending ? 'Submitting…' : 'Submit deletion request'}
        </button>
      </form>
      {msg ? <p className="db-panel-sub">{msg}</p> : null}
    </section>
  )
}
