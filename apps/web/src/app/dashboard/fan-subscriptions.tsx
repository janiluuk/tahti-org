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
  connect,
  payoutStats,
}: {
  initial: FanTier[]
  username: string
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
    <section
      style={{ marginTop: '2rem', padding: '1.5rem', border: '1px solid #eee', borderRadius: 8 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>Fan subscriptions</h2>
        <a href={`/u/${username}/subscribe`} style={{ fontSize: '0.85rem', color: '#2563eb' }}>
          View public page ↗
        </a>
      </div>
      <p style={{ color: '#666', fontSize: '0.875rem', marginTop: '0.5rem' }}>
        Fans subscribe directly to you. You keep the revenue minus Stripe fees and a 2% operational
        fee. Subscribers get the 5× download weighting that boosts your annual grant.
      </p>

      {payoutStats && (
        <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.5rem' }}>
          <p style={{ margin: '0 0 0.35rem' }}>
            {payoutStats.activeSubscribers ?? 0} active subscriber
            {(payoutStats.activeSubscribers ?? 0) === 1 ? '' : 's'}
            {payoutStats.pending > 0 && ` · ${payoutStats.pending} payout pending`}
            {payoutStats.failed > 0 && (
              <span style={{ color: '#b45309' }}>
                {' '}
                · {payoutStats.failed} failed (Stripe transfer retried daily)
              </span>
            )}
            {payoutStats.paidLast30Days > 0 && ` · ${payoutStats.paidLast30Days} paid (30d)`}
          </p>
          {payoutStats.recent && payoutStats.recent.length > 0 && (
            <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid #eee' }}>
                  <th>Tier</th>
                  <th>Net</th>
                  <th>State</th>
                </tr>
              </thead>
              <tbody>
                {payoutStats.recent.map((p) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
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
        <div
          style={{
            marginTop: '1rem',
            padding: '1rem',
            background: '#fffbeb',
            border: '1px solid #fcd34d',
            borderRadius: 8,
          }}
        >
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.9rem' }}>
            Finish Stripe onboarding to start receiving fan subscription payments. You can set up
            tiers now; the subscribe button stays disabled until Stripe approves your account.
          </p>
          {connectError && (
            <p style={{ color: '#dc2626', margin: '0 0 0.5rem', fontSize: '0.85rem' }}>
              {connectError}
            </p>
          )}
          <button
            type="button"
            onClick={startConnect}
            disabled={isPending}
            style={{
              background: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              padding: '0.5rem 1rem',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            {isPending ? 'Opening Stripe…' : 'Connect with Stripe'}
          </button>
        </div>
      )}

      {initial.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: '1rem 0' }}>
          {initial.map((t) => (
            <li
              key={t.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.6rem 0',
                borderBottom: '1px solid #f0f0f0',
                opacity: t.active ? 1 : 0.5,
              }}
            >
              <span>
                <strong>{t.name}</strong> · {eur(t.amountCents)}/mo
                {t.description && <span style={{ color: '#888' }}> — {t.description}</span>}
              </span>
              <button
                onClick={() => toggle(t.id, !t.active)}
                disabled={isPending}
                style={{
                  border: '1px solid #ccc',
                  borderRadius: 4,
                  padding: '0.25rem 0.6rem',
                  background: 'none',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                }}
              >
                {t.active ? 'Disable' : 'Enable'}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div style={{ display: 'grid', gap: '0.5rem', marginTop: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            placeholder="Tier name (e.g. Backer)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ flex: 2, padding: '0.5rem', border: '1px solid #ccc', borderRadius: 4 }}
          />
          <input
            type="number"
            min="1"
            max="100"
            step="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={{ width: 90, padding: '0.5rem', border: '1px solid #ccc', borderRadius: 4 }}
          />
          <span style={{ alignSelf: 'center', color: '#888' }}>€/mo</span>
        </div>
        <input
          placeholder="Short description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={{ padding: '0.5rem', border: '1px solid #ccc', borderRadius: 4 }}
        />
        <textarea
          placeholder={
            'Perks, one per line. Use FAN_CHAT or FAN_NEWSLETTER for gated perks; FLAC for lossless downloads.'
          }
          value={perks}
          onChange={(e) => setPerks(e.target.value)}
          rows={3}
          style={{
            padding: '0.5rem',
            border: '1px solid #ccc',
            borderRadius: 4,
            fontFamily: 'inherit',
          }}
        />
        {error && <p style={{ color: '#dc2626', margin: 0, fontSize: '0.85rem' }}>{error}</p>}
        <button
          onClick={add}
          disabled={isPending}
          style={{
            justifySelf: 'start',
            background: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            padding: '0.5rem 1rem',
            cursor: 'pointer',
          }}
        >
          {isPending ? 'Saving…' : 'Add tier'}
        </button>
      </div>
    </section>
  )
}
