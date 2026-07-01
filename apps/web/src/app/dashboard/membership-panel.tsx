// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ButtonIcon, Panel, Button } from '@tahti/ui'
import { startMembershipCheckout, startMembershipPortal } from './actions'

export default function MembershipPanel({
  status,
  isMember,
  memberNumber,
  priceCents,
  emailVerified,
  hasStripeSubscription = false,
  renewalDueAt,
  subscriptionMigrationRequired = false,
}: {
  status: string
  isMember: boolean
  memberNumber: number | null
  priceCents: number
  emailVerified: boolean
  hasStripeSubscription?: boolean
  renewalDueAt?: string | null
  subscriptionMigrationRequired?: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function openPortal() {
    startTransition(async () => {
      const res = await startMembershipPortal()
      if (res.error) setError(res.error)
      else if (res.portalUrl) window.location.href = res.portalUrl
    })
  }

  function pay() {
    setError(null)
    setMessage(null)
    startTransition(async () => {
      const res = await startMembershipCheckout()
      if (res.error) {
        setError(res.error)
        return
      }
      if (res.checkoutUrl) {
        window.location.href = res.checkoutUrl
        return
      }
      setMessage(`Membership activated — member #${res.memberNumber}`)
      router.refresh()
    })
  }

  if (isMember) {
    const dueLabel =
      renewalDueAt != null
        ? new Date(renewalDueAt).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })
        : null
    return (
      <Panel title="Tahti ry membership" headerTight id="membership">
        <div className="studio-member-card">
          <span className="studio-member-card__badge">Active member #{memberNumber ?? '—'}</span>
          <p className="studio-help">
            Thank you for supporting the cooperative — your membership includes lossless streaming
            for listeners and unlimited live broadcasting.
          </p>
          {subscriptionMigrationRequired && (
            <p className="studio-notice studio-notice--info">
              Your membership uses the legacy one-time path. Subscribe via Stripe for automatic
              annual renewal and billing receipts.
            </p>
          )}
          {dueLabel && !hasStripeSubscription && !subscriptionMigrationRequired && (
            <p className="studio-text-muted-sm">
              Renewal due around {dueLabel}. Pay again from this panel when reminded, or subscribe
              via Stripe on your next checkout.
            </p>
          )}
          {hasStripeSubscription && dueLabel && (
            <p className="studio-text-muted-sm">
              Next renewal around {dueLabel} (Stripe subscription).
            </p>
          )}
          {hasStripeSubscription ? (
            <Button onClick={openPortal} disabled={isPending} variant="ghost">
              {isPending ? 'Opening…' : 'Manage billing'}
            </Button>
          ) : subscriptionMigrationRequired ? (
            <Button onClick={pay} disabled={isPending} variant="primary">
              <ButtonIcon name="check" />
              {isPending
                ? 'Processing…'
                : `Subscribe for auto-renewal (€${(priceCents / 100).toFixed(0)}/year)`}
            </Button>
          ) : null}
        </div>
      </Panel>
    )
  }

  const lapsed = status === 'SUSPENDED'

  return (
    <Panel
      variant="warning"
      title={lapsed ? 'Renew your membership' : 'Complete your membership'}
      headerTight
      id="membership"
      description={`Tahti ry is a member-governed nonprofit. Annual membership is €${(priceCents / 100).toFixed(0)}/year (tax-deductible for eligible professionals in Finland). Adds lossless streaming for listeners and unlimited live broadcasting.`}
    >
      {lapsed && (
        <p className="studio-notice studio-notice--error studio-mb-sm">
          Your membership lapsed — renew to restore lossless streaming and unlimited live time.
        </p>
      )}
      {status === 'PENDING_EMAIL' && (
        <p className="studio-notice studio-notice--error studio-mb-sm">
          Verify your email before completing membership checkout.
        </p>
      )}
      {error && <p className="studio-notice studio-notice--error studio-mb-sm">{error}</p>}
      {message && <p className="studio-notice studio-notice--success studio-mb-sm">{message}</p>}
      <Button
        onClick={pay}
        disabled={isPending || !emailVerified || status === 'PENDING_EMAIL'}
        variant="primary"
      >
        <ButtonIcon name="check" />
        {isPending ? 'Processing…' : `Pay €${(priceCents / 100).toFixed(0)} / year`}
      </Button>
    </Panel>
  )
}
