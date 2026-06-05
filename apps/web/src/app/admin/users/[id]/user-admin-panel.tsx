// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import { suspendUser, unsuspendUser, toggleBoardRole } from '../actions'

export function UserAdminActions({
  userId,
  isBoard,
  suspended,
}: {
  userId: string
  isBoard: boolean
  suspended: boolean
}) {
  const [msg, setMsg] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onToggleBoard() {
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

  return (
    <section className="admin-card" style={{ marginBottom: '1rem' }}>
      <h2>Actions</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        <button type="button" disabled={pending} onClick={onToggleBoard}>
          {isBoard ? 'Remove board role' : 'Grant board role'}
        </button>
        {suspended ? (
          <button type="button" disabled={pending} onClick={onUnsuspend}>
            Unsuspend account
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
        <button type="submit" disabled={pending}>
          Suspend
        </button>
      </form>
      {msg ? <p className="admin-stat-sub">{msg}</p> : null}
    </section>
  )
}
