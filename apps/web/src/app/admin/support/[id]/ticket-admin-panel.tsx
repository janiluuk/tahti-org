// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  addSupportTicketNote,
  createEngagementAdjustment,
  updateSupportTicket,
} from '../../actions'
import { deleteUserAccount } from '../../users/actions'

export function TicketAdminPanel({
  ticketId,
  artistId,
  status,
  subject,
}: {
  ticketId: string
  artistId: string | null
  status: string
  subject: string
}) {
  const [note, setNote] = useState('')
  const [units, setUnits] = useState('')
  const [reason, setReason] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onStatus(next: string) {
    setPending(true)
    const { error } = await updateSupportTicket(ticketId, { status: next })
    setPending(false)
    if (error) setMsg(error)
    else window.location.reload()
  }

  async function onNote(e: React.FormEvent) {
    e.preventDefault()
    if (!note.trim()) return
    setPending(true)
    const { error } = await addSupportTicketNote(ticketId, note.trim())
    setPending(false)
    if (error) setMsg(error)
    else window.location.reload()
  }

  async function onAdjust(e: React.FormEvent) {
    e.preventDefault()
    if (!artistId) return
    setPending(true)
    const { error } = await createEngagementAdjustment({
      userId: artistId,
      units: parseInt(units, 10),
      reason: reason.trim(),
    })
    setPending(false)
    if (error) setMsg(error)
    else {
      setMsg('Adjustment recorded')
      setUnits('')
      setReason('')
    }
  }

  async function onExecuteDeletion() {
    if (!artistId) return
    if (
      !window.confirm(
        'Execute GDPR account deletion? This anonymizes the user and cancels billing.',
      )
    ) {
      return
    }
    setPending(true)
    const { error } = await deleteUserAccount(artistId)
    setPending(false)
    if (error) setMsg(error)
    else window.location.href = `/admin/users/${artistId}`
  }

  return (
    <section className="admin-card" style={{ marginBottom: '1rem' }}>
      <h2>Actions</h2>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        {status !== 'IN_PROGRESS' ? (
          <button type="button" disabled={pending} onClick={() => onStatus('IN_PROGRESS')}>
            Mark in progress
          </button>
        ) : null}
        {status !== 'RESOLVED' ? (
          <button type="button" disabled={pending} onClick={() => onStatus('RESOLVED')}>
            Resolve
          </button>
        ) : null}
        {status !== 'OPEN' ? (
          <button type="button" disabled={pending} onClick={() => onStatus('OPEN')}>
            Reopen
          </button>
        ) : null}
      </div>

      <form onSubmit={onNote} style={{ marginBottom: '1rem' }}>
        <label>
          Add note
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
        </label>
        <button type="submit" disabled={pending}>
          Save note
        </button>
      </form>

      {artistId && subject === 'Account deletion request' ? (
        <p style={{ marginBottom: '1rem' }}>
          <button type="button" disabled={pending} onClick={onExecuteDeletion}>
            Execute account deletion
          </button>
        </p>
      ) : null}

      {artistId ? (
        <form onSubmit={onAdjust}>
          <h3>Engagement adjustment</h3>
          <label>
            Units (+/−)
            <input
              type="number"
              value={units}
              onChange={(e) => setUnits(e.target.value)}
              required
            />
          </label>
          <label>
            Reason
            <input value={reason} onChange={(e) => setReason(e.target.value)} required />
          </label>
          <button type="submit" disabled={pending}>
            Record adjustment
          </button>
        </form>
      ) : null}

      {artistId ? (
        <p className="admin-stat-sub">
          <Link href={`/admin/users/${artistId}`}>User detail →</Link>
        </p>
      ) : null}
      {msg ? <p className="admin-stat-sub">{msg}</p> : null}
    </section>
  )
}
