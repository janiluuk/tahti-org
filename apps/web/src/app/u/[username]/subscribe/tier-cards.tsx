// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { subscribe } from './actions'

interface Tier {
  id: string
  name: string
  amountCents: number
  description: string | null
  perks: string[]
}

function eur(cents: number): string {
  return `€${(cents / 100).toFixed(2)}`
}

export default function TierCards({
  username,
  tiers,
  paymentsReady,
}: {
  username: string
  tiers: Tier[]
  paymentsReady: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)

  function onSubscribe(tierId: string) {
    setMessage(null)
    setPendingId(tierId)
    startTransition(async () => {
      const res = await subscribe(username, tierId)
      setPendingId(null)
      if (res.error) {
        setMessage(res.error)
        return
      }
      if (res.checkoutUrl) {
        window.location.href = res.checkoutUrl
        return
      }
      setMessage('Subscribed — thank you for supporting this artist!')
      router.refresh()
    })
  }

  return (
    <div>
      {message && (
        <p
          style={{
            padding: '0.75rem 1rem',
            background: '#f0f9ff',
            border: '1px solid #bae6fd',
            borderRadius: 8,
            margin: '0 0 1.5rem',
          }}
        >
          {message}
        </p>
      )}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
        }}
      >
        {tiers.map((t) => (
          <div
            key={t.id}
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: 12,
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <h3 style={{ margin: '0 0 0.25rem' }}>{t.name}</h3>
            <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>
              {eur(t.amountCents)}
              <span style={{ fontSize: '0.9rem', fontWeight: 400, color: '#888' }}>/mo</span>
            </div>
            {t.description && <p style={{ color: '#666', marginTop: '0.5rem' }}>{t.description}</p>}
            {t.perks.length > 0 && (
              <ul
                style={{
                  paddingLeft: '1.1rem',
                  margin: '0.75rem 0',
                  color: '#444',
                  fontSize: '0.9rem',
                }}
              >
                {t.perks.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            )}
            <button
              onClick={() => onSubscribe(t.id)}
              disabled={isPending || !paymentsReady}
              title={!paymentsReady ? 'Subscriptions open soon' : undefined}
              style={{
                marginTop: 'auto',
                background: paymentsReady ? '#16a34a' : '#9ca3af',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                padding: '0.6rem 1rem',
                cursor: paymentsReady ? 'pointer' : 'not-allowed',
                fontWeight: 600,
              }}
            >
              {isPending && pendingId === t.id
                ? 'Subscribing…'
                : paymentsReady
                  ? 'Subscribe'
                  : 'Subscriptions open soon'}
            </button>
          </div>
        ))}
      </div>
      <p style={{ color: '#888', fontSize: '0.8rem', marginTop: '1.5rem' }}>
        Direct to artist. 0% org take. A 2% fee covers payment processing and compliance.
      </p>
    </div>
  )
}
