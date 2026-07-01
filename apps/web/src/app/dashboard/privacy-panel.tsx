// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import { ButtonIcon, Panel, Button } from '@tahti/ui'
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
      headerTight
      description="Export your data or request account deletion under GDPR. Deletion is reviewed manually within 30 days."
    >
      <div className="studio-export-grid">
        <a href={`${apiUrl}/api/me/data-export.json`} className="studio-export-card">
          <span className="studio-export-card__label">Data export</span>
          <span className="studio-export-card__hint">Full account JSON download</span>
        </a>
        <a href={`${apiUrl}/api/me/press-kit.json`} className="studio-export-card">
          <span className="studio-export-card__label">Press kit</span>
          <span className="studio-export-card__hint">Artist metadata JSON</span>
        </a>
        <a
          href={`${apiUrl}/api/v1/u/${encodeURIComponent(username)}/press-kit.json`}
          target="_blank"
          rel="noreferrer"
          className="studio-export-card"
        >
          <span className="studio-export-card__label">Public press kit</span>
          <span className="studio-export-card__hint">Shareable URL (opens in new tab)</span>
        </a>
      </div>

      <form onSubmit={onDeletionRequest} className="studio-danger-zone">
        <span className="studio-danger-zone__label">Request account deletion</span>
        <textarea
          className="studio-input"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          required
          maxLength={2000}
          aria-label="Reason for deletion request"
          placeholder="Brief reason (optional context for the board)"
        />
        <Button
          type="submit"
          disabled={pending || !reason.trim()}
          variant="danger"
          className="studio-mt-sm"
        >
          <ButtonIcon name="trash" />
          {pending ? 'Submitting…' : 'Submit deletion request'}
        </Button>
      </form>
      {msg ? (
        <p
          className={`${isError ? 'studio-notice studio-notice--error' : 'studio-notice studio-notice--success'} studio-mt-sm`}
        >
          {msg}
        </p>
      ) : null}
    </Panel>
  )
}
