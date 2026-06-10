'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { TierCard, TierCardGrid } from '@tahti/ui'
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

  const featuredIdx = tiers.length >= 2 ? Math.floor(tiers.length / 2) : -1
  const exampleTier = featuredIdx >= 0 ? tiers[featuredIdx] : (tiers[0] ?? null)
  const exEurRaw = exampleTier ? exampleTier.amountCents / 100 : 5
  const stripeFee = (exEurRaw * 0.014 + 0.25).toFixed(2)
  const tahtiShare = (exEurRaw * 0.02).toFixed(2)
  const artistGets = (exEurRaw - parseFloat(stripeFee) - parseFloat(tahtiShare)).toFixed(2)

  return (
    <div>
      {message ? <p className="tier-message">{message}</p> : null}
      <TierCardGrid>
        {tiers.map((tier, index) => {
          const isFeatured = index === featuredIdx
          const isLoading = isPending && pendingId === tier.id
          return (
            <TierCard
              key={tier.id}
              name={tier.name}
              priceLabel={eur(tier.amountCents)}
              description={tier.description ?? undefined}
              perks={tier.perks}
              featured={isFeatured}
              onSubscribe={() => onSubscribe(tier.id)}
              subscribeLabel={
                isLoading ? 'Subscribing…' : paymentsReady ? 'Subscribe' : 'Subscriptions open soon'
              }
              disabled={isPending || !paymentsReady}
            />
          )
        })}
      </TierCardGrid>
      {exampleTier ? (
        <div className="tier-transparency">
          <strong>Where {eur(exampleTier.amountCents)} actually goes:</strong> Stripe takes ~€
          {stripeFee} (their fees, pass-through). Tahti takes €{tahtiShare} (2%, covers GDPR +
          processing). The artist receives <strong>€{artistGets}</strong>. We&apos;re not a platform
          — we&apos;re plumbing.
        </div>
      ) : null}
      <p className="tier-footnote">
        Direct to artist. 0% org take. A 2% fee covers payment processing and compliance.
      </p>
    </div>
  )
}
