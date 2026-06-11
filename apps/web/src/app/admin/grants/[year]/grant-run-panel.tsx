// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { runGrantCycle } from './actions'

type Props = { year: number; poolCents: number; artistCount: number; sumCheckOk: boolean }

export function GrantRunPanel({ year, poolCents, artistCount, sumCheckOk }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleApprove() {
    const poolEur = (poolCents / 100).toLocaleString('fi-FI', { minimumFractionDigits: 2 })
    const confirmed = confirm(
      `Approve the ${year} grant distribution?\n\nPool: €${poolEur}\nArtists: ${artistCount}\n\n` +
        'This writes real GRANT_DISBURSEMENT ledger entries and cannot be reversed.',
    )
    if (!confirmed) return

    setLoading(true)
    setError(null)
    const r = await runGrantCycle(year)
    setLoading(false)

    if (r.error) {
      setError(r.error)
      return
    }
    router.refresh()
  }

  return (
    <div className="grant-approve">
      <button
        className="ui-btn ui-btn--sm grant-approve__btn"
        onClick={handleApprove}
        disabled={loading || !sumCheckOk}
      >
        {loading ? 'Approving…' : 'Approve distribution'}
      </button>
      {error && <p className="admin-footnote admin-footnote--warn">{error}</p>}
    </div>
  )
}
