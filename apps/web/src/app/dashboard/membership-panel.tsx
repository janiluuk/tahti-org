// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Alert, Button, Panel, Text } from '@/components/ui'
import { startMembershipCheckout, startMembershipPortal } from './actions'

export default function MembershipPanel({
  status,
  isMember,
  memberNumber,
  priceCents,
  emailVerified,
}: {
  status: string
  isMember: boolean
  memberNumber: number | null
  priceCents: number
  emailVerified: boolean
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
    return (
      <Panel title="Tahti ry membership">
        <Text tone="success">
          Active member #{memberNumber ?? '—'} — thank you for supporting the cooperative.
        </Text>
        <Button
          type="button"
          variant="ghost"
          onClick={openPortal}
          disabled={isPending}
          className="studio-mt-md"
        >
          {isPending ? 'Opening…' : 'Manage billing'}
        </Button>
      </Panel>
    )
  }

  return (
    <Panel
      variant="warning"
      title="Complete your membership"
      description={`Tahti ry is a member-governed nonprofit. Annual membership is €${(priceCents / 100).toFixed(0)}/year (tax-deductible for eligible professionals in Finland). Unlocks lossless streaming and unlimited live broadcasting.`}
    >
      {status === 'PENDING_EMAIL' && (
        <Alert variant="error">Verify your email before paying.</Alert>
      )}
      {error && <Alert variant="error">{error}</Alert>}
      {message && <Alert variant="success">{message}</Alert>}
      <Button
        variant="primary"
        onClick={pay}
        disabled={isPending || !emailVerified || status === 'PENDING_EMAIL'}
      >
        {isPending ? 'Processing…' : `Pay €${(priceCents / 100).toFixed(0)} / year`}
      </Button>
    </Panel>
  )
}
