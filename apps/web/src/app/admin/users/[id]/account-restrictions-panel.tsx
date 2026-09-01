// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import type { AccountRestrictionView } from '@tahti/shared'
import { createAccountRestriction, liftAccountRestriction } from '../../actions'

const RESTRICTION_LABELS: Record<AccountRestrictionView['type'], string> = {
  LIVE_SHOW_BOOKING: 'Live show booking',
  UPLOAD: 'Uploads',
  LOGIN: 'Login',
}

const DURATION_OPTIONS: Array<{ label: string; days: number | null }> = [
  { label: '1 day', days: 1 },
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
  { label: 'Indefinite', days: null },
]

function isActive(r: AccountRestrictionView): boolean {
  if (r.liftedAt) return false
  if (!r.expiresAt) return true
  return new Date(r.expiresAt) > new Date()
}

/** Three independent restriction types (booking / upload / login) — an admin
 * restricts each on its own, always with a reason the user sees wherever
 * that restriction is enforced (booking form, upload, login). */
export function AccountRestrictionsPanel({
  userId,
  initialRestrictions,
}: {
  userId: string
  initialRestrictions: AccountRestrictionView[]
}) {
  const [restrictions, setRestrictions] = useState(initialRestrictions)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [openForm, setOpenForm] = useState<AccountRestrictionView['type'] | null>(null)
  const [reason, setReason] = useState('')
  const [durationDays, setDurationDays] = useState<number | null>(7)

  const byType = (type: AccountRestrictionView['type']) =>
    restrictions.find((r) => r.type === type && isActive(r))

  async function onCreate(type: AccountRestrictionView['type']) {
    if (!reason.trim()) {
      setError('Reason is required.')
      return
    }
    setPending(true)
    setError(null)
    const result = await createAccountRestriction(userId, {
      type,
      reason: reason.trim(),
      durationDays,
    })
    setPending(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setOpenForm(null)
    setReason('')
    window.location.reload()
  }

  async function onLift(restrictionId: string) {
    setPending(true)
    setError(null)
    const result = await liftAccountRestriction(userId, restrictionId)
    setPending(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setRestrictions((current) =>
      current.map((r) =>
        r.id === restrictionId ? { ...r, liftedAt: new Date().toISOString() } : r,
      ),
    )
  }

  return (
    <section className="admin-card" style={{ marginBottom: '1rem' }}>
      <h2>Restrictions</h2>
      <p className="admin-stat-sub">
        Each is independent — restricting uploads doesn&apos;t block booking or login, and vice
        versa.
      </p>

      {(['LIVE_SHOW_BOOKING', 'UPLOAD', 'LOGIN'] as const).map((type) => {
        const active = byType(type)
        return (
          <div
            key={type}
            style={{
              marginTop: '1rem',
              paddingTop: '1rem',
              borderTop: '1px solid var(--admin-border)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <strong>{RESTRICTION_LABELS[type]}</strong>
              {active ? (
                <button
                  type="button"
                  className="admin-btn admin-btn--sm"
                  disabled={pending}
                  onClick={() => onLift(active.id)}
                >
                  Lift
                </button>
              ) : (
                <button
                  type="button"
                  className="admin-btn admin-btn--sm"
                  disabled={pending}
                  onClick={() => {
                    setOpenForm(openForm === type ? null : type)
                    setError(null)
                  }}
                >
                  Restrict
                </button>
              )}
            </div>

            {active ? (
              <p className="admin-stat-sub">
                {active.expiresAt
                  ? `Until ${new Date(active.expiresAt).toLocaleString()}`
                  : 'Indefinite'}{' '}
                — {active.reason}
                {active.bannedByUsername ? ` (by @${active.bannedByUsername})` : ''}
              </p>
            ) : (
              <p className="admin-stat-sub">Not restricted.</p>
            )}

            {openForm === type && !active ? (
              <div style={{ marginTop: '0.5rem' }}>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Reason shown to the user (required)"
                  rows={2}
                  style={{ width: '100%', marginBottom: '0.5rem' }}
                  required
                />
                <select
                  value={durationDays ?? ''}
                  onChange={(e) => setDurationDays(e.target.value ? Number(e.target.value) : null)}
                  style={{ marginBottom: '0.5rem' }}
                >
                  {DURATION_OPTIONS.map((opt) => (
                    <option key={opt.label} value={opt.days ?? ''}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <div>
                  <button
                    type="button"
                    className="admin-btn admin-btn--danger admin-btn--sm"
                    disabled={pending}
                    onClick={() => onCreate(type)}
                  >
                    Apply restriction
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )
      })}

      {error ? <p className="admin-err">{error}</p> : null}
    </section>
  )
}
