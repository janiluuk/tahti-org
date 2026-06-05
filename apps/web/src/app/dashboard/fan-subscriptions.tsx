// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createFanTier, setFanTierActive, startFanSubConnectOnboarding } from './actions'

interface FanTier {
  id: string
  name: string
  amountCents: number
  description: string | null
  perks: string[]
  active: boolean
}

interface ConnectStatus {
  stripeConfigured: boolean
  paymentsReady: boolean
  chargesEnabled: boolean
  detailsSubmitted: boolean
}

function eur(cents: number): string {
  return `€${(cents / 100).toFixed(2)}`
}

export default function FanSubscriptionsPanel({
  initial,
  username,
  apiUrl,
  connect,
  payoutStats,
}: {
  initial: FanTier[]
  username: string
  apiUrl: string
  connect: ConnectStatus
  payoutStats?: {
    pending: number
    failed: number
    paidLast30Days: number
    activeSubscribers?: number
    recent?: Array<{
      id: string
      state: string
      tierName: string
      grossCents: number
      netToArtistCents: number
      createdAt: string
    }>
  }
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('5')
  const [description, setDescription] = useState('')
  const [perks, setPerks] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [connectError, setConnectError] = useState<string | null>(null)

  function add() {
    setError(null)
    const cents = Math.round(parseFloat(amount) * 100)
    if (!name.trim() || Number.isNaN(cents)) {
      setError('Name and a valid price are required')
      return
    }
    startTransition(async () => {
      const res = await createFanTier({
        name: name.trim(),
        amountCents: cents,
        description: description.trim() || undefined,
        perks: perks
          .split('\n')
          .map((p) => p.trim())
          .filter(Boolean),
      })
      if (res.error) {
        setError(res.error)
        return
      }
      setName('')
      setAmount('5')
      setDescription('')
      setPerks('')
      router.refresh()
    })
  }

  function toggle(id: string, active: boolean) {
    startTransition(async () => {
      await setFanTierActive(id, active)
      router.refresh()
    })
  }

  function startConnect() {
    setConnectError(null)
    startTransition(async () => {
      const res = await startFanSubConnectOnboarding()
      if (res.error) {
        setConnectError(res.error)
        return
      }
      if (res.onboardingUrl) {
        window.location.href = res.onboardingUrl
      }
    })
  }

  const needsStripe = connect.stripeConfigured && !connect.paymentsReady

  return (
    <section className="studio-panel-section">
      <div className="studio-row--between">
        <h2 className="studio-section-heading studio-m-0">Fan subscriptions</h2>
        <a href={`/u/${username}/subscribe`} className="studio-link-cta">
          View public page ↗
        </a>
      </div>
      <p className="studio-help studio-mt-sm">
        Fans subscribe directly to you. You keep the revenue minus Stripe fees and a 2% operational
        fee. Subscribers get the 5× download weighting that boosts your annual grant.
      </p>

      {payoutStats && (
        <div className="studio-text-muted-sm studio-mt-sm">
          <p className="studio-m-0 studio-mb-sm">
            {payoutStats.activeSubscribers ?? 0} active subscriber
            {(payoutStats.activeSubscribers ?? 0) === 1 ? '' : 's'}
            {payoutStats.pending > 0 && ` · ${payoutStats.pending} payout pending`}
            {payoutStats.failed > 0 && (
              <span className="studio-text-warn">
                {' '}
                · {payoutStats.failed} failed (Stripe transfer retried daily)
              </span>
            )}
            {payoutStats.paidLast30Days > 0 && ` · ${payoutStats.paidLast30Days} paid (30d)`}
            {' · '}
            <a href={`${apiUrl}/api/me/fan-subscribers/export.csv`} className="studio-link-cta">
              Export subscribers (CSV)
            </a>
          </p>
          {payoutStats.recent && payoutStats.recent.length > 0 && (
            <table className="studio-table studio-table--sm">
              <thead>
                <tr>
                  <th>Tier</th>
                  <th>Net</th>
                  <th>State</th>
                </tr>
              </thead>
              <tbody>
                {payoutStats.recent.map((p) => (
                  <tr key={p.id}>
                    <td>{p.tierName}</td>
                    <td>{eur(p.netToArtistCents)}</td>
                    <td>{p.state}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {needsStripe && (
        <div className="studio-stripe-banner">
          <p className="studio-m-0 studio-mb-md studio-text-sm">
            Finish Stripe onboarding to start receiving fan subscription payments. You can set up
            tiers now; the subscribe button stays disabled until Stripe approves your account.
          </p>
          {connectError && (
            <p className="studio-text-error studio-m-0 studio-mb-sm">{connectError}</p>
          )}
          <button
            type="button"
            onClick={startConnect}
            disabled={isPending}
            className="studio-btn-primary"
          >
            {isPending ? 'Opening Stripe…' : 'Connect with Stripe'}
          </button>
        </div>
      )}

      {initial.length > 0 && (
        <ul className="studio-list studio-mt-lg">
          {initial.map((t) => (
            <li
              key={t.id}
              className={`studio-row--between studio-item-row${t.active ? '' : ' studio-tier-inactive'}`}
            >
              <span>
                <strong>{t.name}</strong> · {eur(t.amountCents)}/mo
                {t.description && <span className="studio-text-muted-sm"> — {t.description}</span>}
              </span>
              <button
                onClick={() => toggle(t.id, !t.active)}
                disabled={isPending}
                className="studio-btn-ghost"
              >
                {t.active ? 'Disable' : 'Enable'}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="studio-grid studio-mt-lg">
        <div className="studio-row">
          <input
            placeholder="Tier name (e.g. Backer)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="studio-input studio-flex-1"
          />
          <input
            type="number"
            min="1"
            max="100"
            step="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="studio-input studio-input--narrow"
          />
          <span className="studio-text-muted-sm">€/mo</span>
        </div>
        <input
          placeholder="Short description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="studio-input"
        />
        <textarea
          placeholder={
            'Perks, one per line. Use FAN_CHAT or FAN_NEWSLETTER for gated perks; FLAC for lossless downloads.'
          }
          value={perks}
          onChange={(e) => setPerks(e.target.value)}
          rows={3}
          className="studio-textarea"
        />
        {error && <p className="studio-text-error studio-m-0">{error}</p>}
        <button onClick={add} disabled={isPending} className="studio-btn-primary">
          {isPending ? 'Saving…' : 'Add tier'}
        </button>
      </div>
    </section>
  )
}
