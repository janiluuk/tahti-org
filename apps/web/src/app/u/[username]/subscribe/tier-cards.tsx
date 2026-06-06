// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

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
      {message && <p className="tier-message">{message}</p>}
      <div className="tier-grid">
        {tiers.map((t) => (
          <div key={t.id} className="tier-card">
            <h3>{t.name}</h3>
            <div className="tier-price">
              {eur(t.amountCents)}
              <span className="tier-price-period">/mo</span>
            </div>
            {t.description && <p className="tier-desc">{t.description}</p>}
            {t.perks.length > 0 && (
              <ul className="tier-perks">
                {t.perks.map((p, i) => (
                  <li key={i} className="tier-perk-item">
                    <svg
                      className="tier-perk-check"
                      width="12"
                      height="12"
                      viewBox="0 0 16 16"
                      fill="none"
                      aria-hidden
                    >
                      <path
                        d="M3 8l4 4 6-6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    {p}
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              className="tier-subscribe-btn"
              onClick={() => onSubscribe(t.id)}
              disabled={isPending || !paymentsReady}
              title={!paymentsReady ? 'Subscriptions open soon' : undefined}
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
      <p className="tier-footnote">
        Direct to artist. 0% org take. A 2% fee covers payment processing and compliance.
      </p>
    </div>
  )
}
