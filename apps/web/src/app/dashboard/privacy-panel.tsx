// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import { Panel } from '@tahti/ui'
import { requestAccountDeletion } from './privacy-actions'

export default function PrivacyPanel({ username, apiUrl }: { username: string; apiUrl: string }) {
  const [reason, setReason] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [isError, setIsError] = useState(false)
  const [pending, setPending] = useState(false)

  async function onDeletionRequest(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    setMsg(null)
    setIsError(false)
    const { error, ticketId } = await requestAccountDeletion(reason.trim())
    setPending(false)
    if (error) {
      setIsError(true)
      setMsg(error)
      return
    }
    setMsg(`Deletion request submitted (ticket #${ticketId}). The board will follow up by email.`)
    setReason('')
  }

  return (
    <Panel
      title="Privacy & data"
      description="Export your data or request account deletion under GDPR. Deletion is reviewed manually within 30 days."
    >
      <ul className="studio-list studio-mt-sm studio-list-indented">
        <li className="studio-text-sm" style={{ listStyle: 'disc', padding: '0.15rem 0' }}>
          <a href={`${apiUrl}/api/me/data-export.json`}>Download data export (JSON)</a>
        </li>
        <li className="studio-text-sm" style={{ listStyle: 'disc', padding: '0.15rem 0' }}>
          <a href={`${apiUrl}/api/me/press-kit.json`}>Download press kit (JSON)</a>
        </li>
        <li className="studio-text-sm" style={{ listStyle: 'disc', padding: '0.15rem 0' }}>
          <a
            href={`${apiUrl}/api/v1/u/${encodeURIComponent(username)}/press-kit.json`}
            target="_blank"
            rel="noreferrer"
          >
            Public press kit URL
          </a>
        </li>
      </ul>
      <form onSubmit={onDeletionRequest} className="studio-mt-lg">
        <label className="studio-field--block">
          <span className="studio-label">Request account deletion</span>
          <textarea
            className="studio-input studio-mt-sm"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            required
            maxLength={2000}
            placeholder="Brief reason (optional context for the board)"
          />
        </label>
        <button
          type="submit"
          className="studio-btn-primary studio-mt-sm"
          disabled={pending || !reason.trim()}
        >
          {pending ? 'Submitting…' : 'Submit deletion request'}
        </button>
      </form>
      {msg ? (
        <p className={`${isError ? 'studio-text-error' : 'studio-text-success'} studio-mt-sm`}>
          {msg}
        </p>
      ) : null}
    </Panel>
  )
}
