// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { approveBetaApplication, rejectBetaApplication, resendBetaSetupLink } from '../actions'

export type BetaApplicationRow = {
  id: string
  name: string
  email: string
  artistType: string
  links: string | null
  message: string | null
  source: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  userId: string | null
  username: string | null
  hasPassword: boolean
  setupUrl: string | null
  reviewedAt: string | null
  createdAt: string
}

function suggestUsername(name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
  return base.length >= 2 ? base : 'artist'
}

function BetaApproveForm({ application }: { application: BetaApplicationRow }) {
  const [username, setUsername] = useState(suggestUsername(application.name))
  const [displayName, setDisplayName] = useState(application.name)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [setupUrl, setSetupUrl] = useState<string | null>(null)

  async function onApprove() {
    setPending(true)
    setError(null)
    const { error: err, setupUrl: url } = await approveBetaApplication(application.id, {
      username: username.trim().toLowerCase(),
      displayName: displayName.trim(),
    })
    setPending(false)
    if (err) {
      setError(err)
      return
    }
    setSetupUrl(url ?? null)
  }

  if (setupUrl) {
    return (
      <div className="admin-beta-actions">
        <p className="admin-text-muted">Approved. Password setup link:</p>
        <a href={setupUrl} className="admin-beta-setup-link">
          {setupUrl}
        </a>
      </div>
    )
  }

  return (
    <div className="admin-beta-approve-form">
      <label>
        Username
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          pattern="[a-z0-9_-]+"
          required
        />
      </label>
      <label>
        Display name
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
      </label>
      <div className="admin-beta-action-row">
        <button
          type="button"
          className="ui-btn ui-btn--primary"
          disabled={pending}
          onClick={onApprove}
        >
          {pending ? 'Approving…' : 'Approve'}
        </button>
        <RejectButton id={application.id} disabled={pending} />
      </div>
      {error ? <p className="admin-form-error">{error}</p> : null}
    </div>
  )
}

function RejectButton({ id, disabled }: { id: string; disabled?: boolean }) {
  const [pending, setPending] = useState(false)

  async function onReject() {
    if (!window.confirm('Reject this beta application?')) return
    setPending(true)
    await rejectBetaApplication(id)
    setPending(false)
  }

  return (
    <button
      type="button"
      className="ui-btn ui-btn--ghost"
      disabled={disabled || pending}
      onClick={onReject}
    >
      {pending ? 'Rejecting…' : 'Reject'}
    </button>
  )
}

function ResendSetupButton({ id }: { id: string }) {
  const [pending, setPending] = useState(false)
  const [setupUrl, setSetupUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function onResend() {
    setPending(true)
    setError(null)
    const { error: err, setupUrl: url } = await resendBetaSetupLink(id)
    setPending(false)
    if (err) {
      setError(err)
      return
    }
    setSetupUrl(url ?? null)
  }

  return (
    <div>
      <button
        type="button"
        className="ui-btn ui-btn--secondary"
        disabled={pending}
        onClick={onResend}
      >
        {pending ? 'Sending…' : 'Resend setup link'}
      </button>
      {setupUrl ? (
        <p className="admin-text-muted">
          New link:{' '}
          <a href={setupUrl} className="admin-beta-setup-link">
            {setupUrl}
          </a>
        </p>
      ) : null}
      {error ? <p className="admin-form-error">{error}</p> : null}
    </div>
  )
}

export function BetaApplicationsPanel({ applications }: { applications: BetaApplicationRow[] }) {
  if (applications.length === 0) {
    return <p className="admin-text-muted">No applications in this view.</p>
  }

  return (
    <table className="admin-table admin-beta-table">
      <thead>
        <tr>
          <th>Applied</th>
          <th>Name</th>
          <th>Email</th>
          <th>Artist type</th>
          <th>Status</th>
          <th>Account</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {applications.map((app) => (
          <tr key={app.id}>
            <td>{new Date(app.createdAt).toLocaleDateString()}</td>
            <td>
              <strong>{app.name}</strong>
              {app.message ? (
                <p className="admin-text-muted admin-beta-message">{app.message}</p>
              ) : null}
              {app.links ? (
                <p className="admin-text-muted admin-beta-message">{app.links}</p>
              ) : null}
            </td>
            <td>{app.email}</td>
            <td>{app.artistType}</td>
            <td>{app.status}</td>
            <td>
              {app.userId ? (
                <>
                  <Link href={`/admin/users/${app.userId}`}>@{app.username}</Link>
                  {app.hasPassword ? (
                    <span className="admin-text-muted"> · password set</span>
                  ) : (
                    <span className="admin-text-muted"> · awaiting password</span>
                  )}
                  {app.setupUrl ? (
                    <p>
                      <a href={app.setupUrl} className="admin-beta-setup-link">
                        Setup link
                      </a>
                    </p>
                  ) : null}
                </>
              ) : (
                '—'
              )}
            </td>
            <td>
              {app.status === 'PENDING' ? <BetaApproveForm application={app} /> : null}
              {app.status === 'APPROVED' && app.userId && !app.hasPassword ? (
                <ResendSetupButton id={app.id} />
              ) : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
