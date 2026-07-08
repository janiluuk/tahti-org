// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ButtonIcon, Panel, Button } from '@tahti/ui'
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

const KNOWN_PERKS = [
  { key: 'FAN_CHAT', label: 'Fan-only chat' },
  { key: 'FAN_NEWSLETTER', label: 'Newsletter' },
  { key: 'FLAC', label: 'Lossless downloads' },
] as const

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
  const [amount, setAmount] = useState(5)
  const [description, setDescription] = useState('')
  const [togglablePerks, setTogglablePerks] = useState<Set<string>>(new Set())
  const [customPerks, setCustomPerks] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [connectError, setConnectError] = useState<string | null>(null)

  function togglePerk(key: string) {
    setTogglablePerks((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function add() {
    setError(null)
    const cents = Math.round(amount * 100)
    if (!name.trim()) {
      setError('Name is required')
      return
    }
    startTransition(async () => {
      const res = await createFanTier({
        name: name.trim(),
        amountCents: cents,
        description: description.trim() || undefined,
        perks: [
          ...togglablePerks,
          ...customPerks
            .split('\n')
            .map((p) => p.trim())
            .filter(Boolean),
        ],
      })
      if (res.error) {
        setError(res.error)
        return
      }
      setName('')
      setAmount(5)
      setDescription('')
      setTogglablePerks(new Set())
      setCustomPerks('')
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
  const activeTier = initial.find((t) => t.active)

  return (
    <>
      <div className="fan-subs-hero" data-hero>
        <span className="fan-subs-hero__count">{payoutStats?.activeSubscribers ?? 0}</span>
        <div>
          <p className="fan-subs-hero__label">
            active subscriber{(payoutStats?.activeSubscribers ?? 0) === 1 ? '' : 's'}
          </p>
          {activeTier && (
            <p className="studio-text-muted-sm studio-m-0">
              {activeTier.name} · {eur(activeTier.amountCents)}/mo
            </p>
          )}
        </div>
        <Link
          href={`/u/${username}/subscribe`}
          className="ui-btn ui-btn--sm ui-btn--ghost fan-subs-hero__link"
        >
          View public page ↗
        </Link>
      </div>

      <Panel
        title="Fan subscriptions"
        headerTight
        description="Fans subscribe directly to you. You keep the revenue minus Stripe fees and a 2% operational fee. Subscribers get the 5× download weighting that boosts your annual grant."
        className="import-page__panel studio-mt-md"
        flushTop
      >
        {payoutStats && (
          <div className="studio-text-muted-sm">
            <p className="studio-m-0 studio-mb-sm">
              {payoutStats.pending > 0 && `${payoutStats.pending} payout pending`}
              {payoutStats.failed > 0 && (
                <span className="studio-text-warn">
                  {payoutStats.pending > 0 ? ' · ' : ''}
                  {payoutStats.failed} failed (Stripe transfer retried daily)
                </span>
              )}
              {payoutStats.paidLast30Days > 0 &&
                `${payoutStats.pending > 0 || payoutStats.failed > 0 ? ' · ' : ''}${payoutStats.paidLast30Days} paid (30d)`}
              {(payoutStats.pending > 0 ||
                payoutStats.failed > 0 ||
                payoutStats.paidLast30Days > 0) &&
                ' · '}
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
            <Button onClick={startConnect} disabled={isPending} variant="primary">
              <ButtonIcon name="link" />
              {isPending ? 'Opening Stripe…' : 'Connect with Stripe'}
            </Button>
          </div>
        )}

        {initial.length === 0 && <p className="studio-empty">No fan tiers yet.</p>}

        {initial.length > 0 && (
          <ul className="studio-list studio-mt-md">
            {initial.map((t) => (
              <li
                key={t.id}
                className={`studio-row--between studio-item-row${t.active ? '' : ' studio-tier-inactive'}`}
              >
                <span>
                  <strong>{t.name}</strong> · {eur(t.amountCents)}/mo
                  {t.description && (
                    <span className="studio-text-muted-sm"> — {t.description}</span>
                  )}
                </span>
                <Button
                  onClick={() => toggle(t.id, !t.active)}
                  disabled={isPending}
                  variant="ghost"
                  size="sm"
                >
                  {t.active ? 'Disable' : 'Enable'}
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="studio-grid studio-mt-md">
          <label className="studio-field">
            <span className="studio-label">Tier name</span>
            <input
              placeholder="e.g. Backer"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="studio-input"
            />
          </label>

          <div className="fan-tier-price">
            <span className="fan-tier-price__value">{eur(Math.round(amount * 100))}/mo</span>
            <input
              type="range"
              min={1}
              max={50}
              step={1}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="fan-tier-price__slider"
              aria-label="Monthly price"
            />
          </div>

          <label className="studio-field">
            <span className="studio-label">Description (optional)</span>
            <input
              placeholder="Short description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="studio-input"
            />
          </label>

          <div className="fan-tier-perks">
            {KNOWN_PERKS.map((perk) => (
              <button
                key={perk.key}
                type="button"
                className={`fan-tier-perk-card${togglablePerks.has(perk.key) ? ' fan-tier-perk-card--active' : ''}`}
                onClick={() => togglePerk(perk.key)}
              >
                {perk.label}
              </button>
            ))}
          </div>

          <label className="studio-field">
            <span className="studio-label">Additional perks (optional)</span>
            <textarea
              placeholder="One per line"
              value={customPerks}
              onChange={(e) => setCustomPerks(e.target.value)}
              rows={2}
              className="studio-textarea"
            />
          </label>
          {error && <p className="studio-text-error studio-m-0">{error}</p>}
          <Button onClick={add} disabled={isPending} variant="primary">
            <ButtonIcon name="plus" />
            {isPending ? 'Saving…' : 'Add tier'}
          </Button>
        </div>
      </Panel>
    </>
  )
}
