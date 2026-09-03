// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ButtonIcon, Panel, Button } from '@tahti/ui'
import { createPurchaseTier, messageBuyer, setPurchaseTierActive, setStoreEnabled } from './actions'

interface PurchaseTier {
  id: string
  name: string
  priceCents: number
  priceOptional: boolean
  description: string | null
  active: boolean
}

interface Order {
  id: string
  amountCents: number
  createdAt: string
  tier: { id: string; name: string }
  buyer: { username: string; displayName: string; avatarUrl: string | null }
}

interface ConnectStatus {
  stripeConfigured: boolean
  paymentsReady: boolean
}

function eur(cents: number): string {
  return `€${(cents / 100).toFixed(2)}`
}

const TIER_ACCENTS = ['purple', 'cyan', 'amber', 'green'] as const

export default function PurchaseTiersPanel({
  initial,
  orders,
  connect,
  storeEnabled: initialStoreEnabled,
}: {
  initial: PurchaseTier[]
  orders: Order[]
  connect: ConnectStatus
  storeEnabled: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [storeEnabled, setStoreEnabledState] = useState(initialStoreEnabled)
  const [name, setName] = useState('')
  const [price, setPrice] = useState(5)
  const [priceOptional, setPriceOptional] = useState(false)
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [messagingId, setMessagingId] = useState<string | null>(null)

  function add() {
    setError(null)
    if (!name.trim()) {
      setError('Name is required')
      return
    }
    startTransition(async () => {
      const res = await createPurchaseTier({
        name: name.trim(),
        priceCents: Math.round(price * 100),
        priceOptional,
        description: description.trim() || undefined,
      })
      if (res.error) {
        setError(res.error)
        return
      }
      setName('')
      setPrice(5)
      setPriceOptional(false)
      setDescription('')
      router.refresh()
    })
  }

  function toggle(id: string, active: boolean) {
    startTransition(async () => {
      await setPurchaseTierActive(id, active)
      router.refresh()
    })
  }

  function message(username: string) {
    setMessagingId(username)
    startTransition(async () => {
      const res = await messageBuyer(username)
      setMessagingId(null)
      if (!res.error && res.conversationId) {
        router.push(`/dashboard/messages/${res.conversationId}`)
      }
    })
  }

  function toggleStore(checked: boolean) {
    setStoreEnabledState(checked)
    startTransition(async () => {
      const res = await setStoreEnabled(checked)
      if (res.error) setStoreEnabledState(!checked)
    })
  }

  const needsStripe = connect.stripeConfigured && !connect.paymentsReady

  return (
    <Panel
      title="One-time tiers"
      headerTight
      description="Price a track once and assign it in the track editor's Access tab — fans buy access without subscribing. Active fan-subscribers always get everything for free."
      className="import-page__panel studio-mt-md"
      flushTop
    >
      <label className="studio-label-row">
        <input
          type="checkbox"
          checked={storeEnabled}
          onChange={(e) => toggleStore(e.target.checked)}
        />
        Show a Store section on my public artist page
      </label>

      {needsStripe && (
        <div className="studio-stripe-banner">
          <p className="studio-m-0 studio-text-sm">
            Finish Stripe onboarding under Fan subscriptions to start accepting purchases. You can
            set up tiers now.
          </p>
        </div>
      )}

      <div className="fan-subs-layout studio-mt-md">
        <div className="fan-subs-layout__col">
          {initial.length === 0 && <p className="studio-empty">No purchase tiers yet.</p>}

          {initial.length > 0 && (
            <ul className="fan-tier-list">
              {initial.map((t, i) => (
                <li
                  key={t.id}
                  className={`fan-tier-card fan-tier-card--${TIER_ACCENTS[i % TIER_ACCENTS.length]}${t.active ? '' : ' fan-tier-card--inactive'}`}
                >
                  <div className="fan-tier-card__main">
                    <span className="fan-tier-card__name">{t.name}</span>
                    <span className="fan-tier-card__price">
                      {t.priceOptional ? `${eur(t.priceCents)} suggested` : eur(t.priceCents)}
                    </span>
                    {t.description && <span className="fan-tier-card__desc">{t.description}</span>}
                  </div>
                  <div className="fan-tier-card__side">
                    <span
                      className={`fan-tier-card__status${t.active ? ' fan-tier-card__status--active' : ''}`}
                    >
                      {t.active ? 'Active' : 'Inactive'}
                    </span>
                    <Button
                      onClick={() => toggle(t.id, !t.active)}
                      disabled={isPending}
                      variant={t.active ? 'ghost' : 'primary'}
                      size="sm"
                    >
                      {t.active ? 'Disable' : 'Enable'}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="studio-mt-lg">
            <span className="studio-label">Orders</span>
            {orders.length === 0 ? (
              <p className="studio-empty studio-mt-sm">No orders yet.</p>
            ) : (
              <table className="studio-table studio-table--sm studio-mt-sm">
                <thead>
                  <tr>
                    <th>Buyer</th>
                    <th>Tier</th>
                    <th>Paid</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td>{o.buyer.displayName}</td>
                      <td>{o.tier.name}</td>
                      <td>{eur(o.amountCents)}</td>
                      <td>
                        <Button
                          onClick={() => message(o.buyer.username)}
                          disabled={isPending && messagingId === o.buyer.username}
                          variant="ghost"
                          size="sm"
                        >
                          {messagingId === o.buyer.username ? 'Opening…' : 'Message'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="fan-subs-layout__col">
          <span className="studio-label">Add a new tier</span>
          <div className="studio-grid studio-mt-sm">
            <label className="studio-field">
              <span className="studio-label">Tier name</span>
              <input
                placeholder="e.g. Unreleased demo"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="studio-input"
              />
            </label>

            <div className="fan-tier-price">
              <span className="fan-tier-price__value">{eur(Math.round(price * 100))}</span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
                className="fan-tier-price__slider"
                aria-label="Price"
              />
            </div>

            <label className="studio-label-row">
              <input
                type="checkbox"
                checked={priceOptional}
                onChange={(e) => setPriceOptional(e.target.checked)}
              />
              Price is optional — buyers can name their own amount (including free) and still get
              the order
            </label>

            <label className="studio-field">
              <span className="studio-label">Description (optional)</span>
              <input
                placeholder="Short description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="studio-input"
              />
            </label>
            {error && <p className="studio-text-error studio-m-0">{error}</p>}
            <Button onClick={add} disabled={isPending} variant="primary">
              <ButtonIcon name="plus" />
              {isPending ? 'Saving…' : 'Add tier'}
            </Button>
          </div>
        </div>
      </div>
    </Panel>
  )
}
