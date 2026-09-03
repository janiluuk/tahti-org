// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { ArchiveItemAccessPatch } from '@tahti/shared'
import { ButtonIcon, Panel, Button } from '@tahti/ui'
import { fetchMyPurchaseTiers, updateArchiveItemAccess } from './channel-visual-actions'

type AccessMode = ArchiveItemAccessPatch['accessMode']

interface Tier {
  id: string
  name: string
  priceCents: number
  active: boolean
}

function eur(cents: number): string {
  return `€${(cents / 100).toFixed(2)}`
}

export default function ArchiveAccessPanel({
  itemId,
  initial,
}: {
  itemId: string
  initial: { accessMode: AccessMode; purchaseTierId: string | null }
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [gated, setGated] = useState(initial.accessMode !== 'FREE')
  const [mode, setMode] = useState<AccessMode>(initial.accessMode)
  const [tierId, setTierId] = useState<string | null>(initial.purchaseTierId)
  const [tiers, setTiers] = useState<Tier[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (gated && mode === 'PURCHASE' && tiers === null) {
      void fetchMyPurchaseTiers().then((t) => setTiers(t.filter((tier) => tier.active)))
    }
  }, [gated, mode, tiers])

  function toggleGated(checked: boolean) {
    setGated(checked)
    if (!checked) {
      setMode('FREE')
      setTierId(null)
    } else if (mode === 'FREE') {
      // No choice made yet — the two buttons below decide SUBSCRIBERS_ONLY vs PURCHASE.
      setMode('SUBSCRIBERS_ONLY')
    }
  }

  function chooseSubscribersOnly() {
    setMode('SUBSCRIBERS_ONLY')
    setTierId(null)
  }

  function choosePurchase() {
    // Fetching itself is left to the effect above, which fires once mode
    // flips to PURCHASE — avoids a duplicate request racing it here.
    setMode('PURCHASE')
  }

  function save() {
    setError(null)
    setMessage(null)
    if (mode === 'PURCHASE' && !tierId) {
      setError('Pick a tier first')
      return
    }
    startTransition(async () => {
      const res = await updateArchiveItemAccess(itemId, {
        accessMode: gated ? mode : 'FREE',
        purchaseTierId: gated && mode === 'PURCHASE' ? tierId : null,
      })
      if (res.error) {
        setError(res.error)
        return
      }
      setMessage('Saved.')
      router.refresh()
    })
  }

  return (
    <Panel
      title="Access"
      headerTight
      description="Free by default. Gate this track behind an active fan subscription, or a one-time purchase tier — buying a tier only unlocks that tier's own tracks."
    >
      <label className="studio-label-row">
        <input type="checkbox" checked={gated} onChange={(e) => toggleGated(e.target.checked)} />
        Restrict who can play this track
      </label>

      {gated && (
        <div className="studio-row studio-row--wrap studio-gap-sm studio-mt-sm">
          <Button
            onClick={chooseSubscribersOnly}
            variant={mode === 'SUBSCRIBERS_ONLY' ? 'primary' : 'ghost'}
            size="sm"
          >
            Subscribers only
          </Button>
          <Button
            onClick={choosePurchase}
            variant={mode === 'PURCHASE' ? 'primary' : 'ghost'}
            size="sm"
          >
            One-time purchase
          </Button>
        </div>
      )}

      {gated && mode === 'PURCHASE' && (
        <div className="studio-field--block studio-mt-sm">
          <span className="studio-label">Tier</span>
          {tiers === null && <p className="studio-text-muted-sm">Loading your tiers…</p>}
          {tiers !== null && tiers.length === 0 && (
            <p className="studio-text-muted-sm">
              No active tiers yet —{' '}
              <a href="/dashboard/settings/purchase-tiers" className="studio-link-cta">
                create one
              </a>
              .
            </p>
          )}
          {tiers !== null && tiers.length > 0 && (
            <select
              value={tierId ?? ''}
              onChange={(e) => setTierId(e.target.value || null)}
              className="studio-input"
            >
              <option value="" disabled>
                Choose a tier…
              </option>
              {tiers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} — {eur(t.priceCents)}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {error && <p className="studio-notice studio-notice--error">{error}</p>}
      {message && <p className="studio-notice studio-notice--success">{message}</p>}

      <Button onClick={save} disabled={isPending} variant="primary">
        <ButtonIcon name="save" />
        {isPending ? 'Saving…' : 'Save'}
      </Button>
    </Panel>
  )
}
