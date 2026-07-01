// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import { suspendUser, unsuspendUser, toggleBoardRole, deleteUserAccount } from '../actions'

export function UserAdminActions({
  userId,
  isBoard,
  suspended,
  deleted,
}: {
  userId: string
  isBoard: boolean
  suspended: boolean
  deleted?: boolean
}) {
  const [msg, setMsg] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onToggleBoard() {
    const action = isBoard
      ? 'Remove board role from this account?'
      : 'Grant board role to this account?'
    if (!window.confirm(action)) return
    setPending(true)
    setMsg(null)
    const { error } = await toggleBoardRole(userId, !isBoard)
    setPending(false)
    setMsg(error ?? (isBoard ? 'Board role removed' : 'Board role granted'))
  }

  async function onUnsuspend() {
    setPending(true)
    setMsg(null)
    const { error } = await unsuspendUser(userId)
    setPending(false)
    setMsg(error ?? 'Account unsuspended')
    if (!error) window.location.reload()
  }

  async function onDeleteAccount() {
    if (
      !window.confirm(
        'Permanently anonymize this account? Billing will be canceled and PII removed. This cannot be undone.',
      )
    ) {
      return
    }
    setPending(true)
    setMsg(null)
    const { error } = await deleteUserAccount(userId)
    setPending(false)
    if (error) {
      setMsg(error)
      return
    }
    window.location.href = '/admin/users'
  }

  return (
    <section className="admin-card" style={{ marginBottom: '1rem' }}>
      <h2>Actions</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        <button
          type="button"
          className="admin-btn admin-btn--sm"
          disabled={pending}
          onClick={onToggleBoard}
        >
          {isBoard ? 'Remove board role' : 'Grant board role'}
        </button>
        {suspended ? (
          <button
            type="button"
            className="admin-btn admin-btn--sm"
            disabled={pending}
            onClick={onUnsuspend}
          >
            Unsuspend account
          </button>
        ) : null}
        {!deleted ? (
          <button
            type="button"
            className="admin-btn admin-btn--danger admin-btn--sm"
            disabled={pending || isBoard}
            onClick={onDeleteAccount}
          >
            Delete account (GDPR)
          </button>
        ) : null}
      </div>
      {msg ? <p className="admin-stat-sub">{msg}</p> : null}
    </section>
  )
}

export function SuspendUserForm({ userId }: { userId: string }) {
  const [reason, setReason] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!reason.trim()) return
    if (!window.confirm('Suspend this account? They will lose access immediately.')) return
    setPending(true)
    setMsg(null)
    const { error } = await suspendUser(userId, reason.trim())
    setPending(false)
    setMsg(error ?? 'Account suspended')
    if (!error) window.location.reload()
  }

  return (
    <section className="admin-card">
      <h2>Suspend account</h2>
      <form onSubmit={onSubmit}>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (required)"
          rows={3}
          style={{ width: '100%', marginBottom: '0.5rem' }}
          required
        />
        <button type="submit" className="admin-btn admin-btn--danger" disabled={pending}>
          Suspend
        </button>
      </form>
      {msg ? <p className="admin-stat-sub">{msg}</p> : null}
    </section>
  )
}
