// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Callout } from '@/components/ui/from-tahti-ui'
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
        <Callout label="Status" variant="cyan">
          {message}
        </Callout>
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
            className="brand-panel"
            style={{ display: 'flex', flexDirection: 'column' }}
          >
            <h3 style={{ margin: '0 0 0.25rem' }}>{t.name}</h3>
            <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>
              {eur(t.amountCents)}
              <span style={{ fontSize: '0.9rem', fontWeight: 400, color: '#888' }}>/mo</span>
            </div>
            {t.description && (
              <p className="brand-muted" style={{ marginTop: '0.5rem' }}>
                {t.description}
              </p>
            )}
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
            <Button
              type="button"
              variant="primary"
              disabled={isPending || !paymentsReady}
              title={!paymentsReady ? 'Subscriptions open soon' : undefined}
              onClick={() => onSubscribe(t.id)}
              style={{ marginTop: 'auto' }}
            >
              {isPending && pendingId === t.id
                ? 'Subscribing…'
                : paymentsReady
                  ? 'Subscribe'
                  : 'Subscriptions open soon'}
            </Button>
          </div>
        ))}
      </div>
      <p className="brand-muted" style={{ fontSize: '0.8rem', marginTop: '1.5rem' }}>
        Direct to artist. 0% org take. A 2% fee covers payment processing and compliance.
      </p>
    </div>
  )
}
