// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { startMembershipCheckout } from './actions'

export default function MembershipPanel({
  status,
  isMember,
  memberNumber,
  priceCents,
  emailVerified,
}: {
  status: string
  isMember: boolean
  memberNumber: number | null
  priceCents: number
  emailVerified: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (isMember) {
    return (
      <section
        style={{ marginTop: '2rem', padding: '1.5rem', border: '1px solid #eee', borderRadius: 8 }}
      >
        <h2 style={{ margin: 0 }}>Tahti ry membership</h2>
        <p style={{ color: '#16a34a', marginTop: '0.5rem' }}>
          Active member #{memberNumber ?? '—'} — thank you for supporting the cooperative.
        </p>
      </section>
    )
  }

  function pay() {
    setError(null)
    setMessage(null)
    startTransition(async () => {
      const res = await startMembershipCheckout()
      if (res.error) {
        setError(res.error)
        return
      }
      if (res.checkoutUrl) {
        window.location.href = res.checkoutUrl
        return
      }
      setMessage(`Membership activated — member #${res.memberNumber}`)
      router.refresh()
    })
  }

  return (
    <section
      style={{
        marginTop: '2rem',
        padding: '1.5rem',
        border: '1px solid #fbbf24',
        borderRadius: 8,
        background: '#fffbeb',
      }}
    >
      <h2 style={{ margin: 0 }}>Complete your membership</h2>
      <p style={{ marginTop: '0.5rem', color: '#555' }}>
        Tahti ry is a member-governed nonprofit. Annual membership is €
        {(priceCents / 100).toFixed(0)}
        /year (tax-deductible for eligible professionals in Finland). Unlocks lossless streaming and
        unlimited live broadcasting.
      </p>
      {status === 'PENDING_EMAIL' && (
        <p style={{ color: '#dc2626' }}>Verify your email before paying.</p>
      )}
      {error && <p style={{ color: '#dc2626' }}>{error}</p>}
      {message && <p style={{ color: '#16a34a' }}>{message}</p>}
      <button
        onClick={pay}
        disabled={isPending || !emailVerified || status === 'PENDING_EMAIL'}
        style={{
          marginTop: '0.75rem',
          background: '#2563eb',
          color: 'white',
          border: 'none',
          borderRadius: 4,
          padding: '0.5rem 1rem',
          cursor: 'pointer',
        }}
      >
        {isPending ? 'Processing…' : `Pay €${(priceCents / 100).toFixed(0)} / year`}
      </button>
    </section>
  )
}
