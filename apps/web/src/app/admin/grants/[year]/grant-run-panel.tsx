// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import { runGrantCycle } from './actions'

type Props = { year: number; alreadyRun: boolean }

export function GrantRunPanel({ year, alreadyRun }: Props) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{
    error?: string
    poolCents?: number
    grantCount?: number
    reserveCents?: number
    alreadyRun?: boolean
  } | null>(null)

  async function handleRun() {
    if (
      !confirm(
        `Run the ${year} grant disbursement? This writes real ledger entries and cannot be reversed.`,
      )
    )
      return
    setLoading(true)
    const r = await runGrantCycle(year)
    setLoading(false)
    setResult(r)
  }

  if (alreadyRun && !result) {
    return (
      <p className="admin-stat-sub" style={{ color: 'var(--amber)' }}>
        Grants for {year} have already been disbursed.
      </p>
    )
  }

  if (result?.alreadyRun) {
    return (
      <p className="admin-stat-sub" style={{ color: 'var(--amber)' }}>
        Grants for {year} have already been disbursed.
      </p>
    )
  }

  if (result?.error) {
    return (
      <p className="admin-stat-sub" style={{ color: 'var(--coral)' }}>
        Error: {result.error}
      </p>
    )
  }

  if (result?.poolCents !== undefined) {
    return (
      <div style={{ color: 'var(--green)', fontSize: '0.9rem' }}>
        ✓ Disbursed — pool €{(result.poolCents / 100).toLocaleString('fi-FI')} to{' '}
        {result.grantCount} artists. Reserve: €
        {((result.reserveCents ?? 0) / 100).toLocaleString('fi-FI')}.
      </div>
    )
  }

  return (
    <button className="admin-btn admin-btn--danger" onClick={handleRun} disabled={loading}>
      {loading ? 'Running…' : `Run ${year} grant disbursement`}
    </button>
  )
}
