// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useTransition } from 'react'
import { TierCard, TierCardGrid } from '@tahti/ui'
import { buyPurchaseTier } from './store-actions'

interface Tier {
  id: string
  name: string
  description: string | null
  priceCents: number
  priceOptional: boolean
}

function eur(cents: number): string {
  return `€${(cents / 100).toFixed(2)}`
}

function BuyAction({
  tier,
  username,
  paymentsReady,
}: {
  tier: Tier
  username: string
  paymentsReady: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const [amount, setAmount] = useState(tier.priceCents / 100)
  const [message, setMessage] = useState<string | null>(null)

  function buy() {
    setMessage(null)
    startTransition(async () => {
      const res = await buyPurchaseTier(
        username,
        tier.id,
        tier.priceOptional ? Math.round(amount * 100) : undefined,
      )
      if (res.error) {
        setMessage(res.error)
        return
      }
      if (res.checkoutUrl) {
        window.location.href = res.checkoutUrl
        return
      }
      setMessage('Purchased — thank you!')
    })
  }

  return (
    <div className="tier-card__buy">
      {tier.priceOptional && (
        <input
          type="number"
          min={0}
          step={0.5}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          className="tier-card__amount-input"
          aria-label="Amount to pay"
        />
      )}
      <button
        type="button"
        className="tier-card__subscribe"
        onClick={buy}
        disabled={isPending || !paymentsReady}
      >
        {isPending ? 'Starting…' : paymentsReady ? 'Buy' : 'Store opens soon'}
      </button>
      {message && <p className="tier-message">{message}</p>}
    </div>
  )
}

export default function StoreSection({
  username,
  tiers,
  paymentsReady,
}: {
  username: string
  tiers: Tier[]
  paymentsReady: boolean
}) {
  return (
    <TierCardGrid>
      {tiers.map((tier) => (
        <TierCard
          key={tier.id}
          name={tier.name}
          priceLabel={tier.priceOptional ? `${eur(tier.priceCents)}+` : eur(tier.priceCents)}
          period=""
          description={tier.description ?? undefined}
          action={<BuyAction tier={tier} username={username} paymentsReady={paymentsReady} />}
        />
      ))}
    </TierCardGrid>
  )
}
