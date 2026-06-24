// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import { createLedgerEntry } from '../../actions'

const CATEGORIES = [
  'REVENUE_SUBSCRIPTION',
  'REVENUE_DISTRIBUTION',
  'REVENUE_GRANT_INBOUND',
  'REVENUE_DONATION',
  'COST_INFRASTRUCTURE',
  'COST_DISTRIBUTION_PASSTHROUGH',
  'COST_OPERATIONS',
  'COST_SALARY',
  'COST_AUDIT',
  'COST_PROFESSIONAL_SERVICES',
  'GRANT_DISBURSEMENT',
  'RESERVE_TRANSFER',
] as const

export function LedgerEntryForm() {
  const now = new Date()
  const monthStart = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0))
    .toISOString()
    .slice(0, 10)

  const [msg, setMsg] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    setMsg(null)
    const fd = new FormData(e.currentTarget)
    const { error } = await createLedgerEntry({
      category: String(fd.get('category')),
      amountCents: Math.round(Number(fd.get('amountEur')) * 100),
      description: String(fd.get('description')),
      periodStart: String(fd.get('periodStart')),
      periodEnd: String(fd.get('periodEnd')),
      externalRef: String(fd.get('externalRef') || '') || undefined,
    })
    setPending(false)
    if (error) {
      setMsg(error)
      return
    }
    setMsg('Entry created')
    window.location.reload()
  }

  return (
    <details className="admin-card studio-details-block" style={{ marginBottom: '1.5rem' }}>
      <summary>New manual entry</summary>
      <form onSubmit={onSubmit} style={{ marginTop: '0.75rem' }}>
        <div style={{ display: 'grid', gap: '0.75rem', maxWidth: '36rem' }}>
          <label>
            Category
            <select name="category" required defaultValue="COST_INFRASTRUCTURE">
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label>
            Amount (EUR)
            <input name="amountEur" type="number" step="0.01" min="0.01" required />
          </label>
          <label>
            Description
            <input name="description" required maxLength={500} />
          </label>
          <label>
            Period start
            <input name="periodStart" type="date" required defaultValue={monthStart} />
          </label>
          <label>
            Period end
            <input name="periodEnd" type="date" required defaultValue={monthEnd} />
          </label>
          <label>
            External reference (optional)
            <input name="externalRef" maxLength={200} />
          </label>
          <button type="submit" disabled={pending}>
            {pending ? 'Saving…' : 'Create entry'}
          </button>
          {msg ? <p className={msg === 'Entry created' ? 'admin-ok' : 'admin-err'}>{msg}</p> : null}
        </div>
      </form>
    </details>
  )
}
