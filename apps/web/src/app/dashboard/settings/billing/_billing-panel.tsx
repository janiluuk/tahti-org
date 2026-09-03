'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useState, useTransition } from 'react'
import { ButtonIcon, Panel, Button } from '@tahti/ui'
import { startMembershipPortal } from '../../actions'

export default function BillingPanel({
  isMember,
  hasStripeSubscription,
  stripeConfigured,
}: {
  isMember: boolean
  hasStripeSubscription: boolean
  stripeConfigured: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function openPortal() {
    setError(null)
    startTransition(async () => {
      const res = await startMembershipPortal()
      if (res.error) setError(res.error)
      else if (res.portalUrl) window.location.href = res.portalUrl
    })
  }

  if (!isMember) {
    return (
      <Panel title="Billing" headerTight>
        <p className="studio-help">
          Billing management becomes available once your membership is active. Pay your membership
          on the Payment tab first.
        </p>
      </Panel>
    )
  }

  if (!stripeConfigured) {
    return (
      <Panel title="Billing" headerTight>
        <p className="studio-help">
          Your membership isn&apos;t on a Stripe subscription, so there&apos;s nothing to manage
          here — see the Payment tab to switch to auto-renewing billing.
        </p>
      </Panel>
    )
  }

  return (
    <Panel
      title="Billing"
      headerTight
      description="Update your payment method, view your subscription, or cancel auto-renewal via Stripe's secure billing portal."
    >
      {error && <p className="studio-notice studio-notice--error studio-mb-sm">{error}</p>}
      <Button onClick={openPortal} disabled={isPending} variant="primary">
        <ButtonIcon name="arrowRight" />
        {isPending ? 'Opening…' : 'Open billing portal'}
      </Button>
      {!hasStripeSubscription && (
        <p className="studio-text-muted-sm studio-mt-xs">
          You have a Stripe customer on file but no active subscription yet — the portal still lets
          you manage saved payment methods.
        </p>
      )}
    </Panel>
  )
}
