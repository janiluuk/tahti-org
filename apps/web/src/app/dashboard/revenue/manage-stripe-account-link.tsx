'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useState, useTransition } from 'react'
import { openFanSubConnectPortal } from '../actions'
import { Button } from '@tahti/ui'

export function ManageStripeAccountLink() {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function open() {
    setError(null)
    startTransition(async () => {
      const res = await openFanSubConnectPortal()
      if (res.error) {
        setError(res.error)
        return
      }
      if (res.url) {
        window.location.href = res.url
      }
    })
  }

  return (
    <>
      <Button onClick={open} disabled={isPending} variant="secondary" size="sm">
        {isPending ? 'Opening…' : 'Manage Stripe account ↗'}
      </Button>
      {error && <p className="admin-footnote admin-footnote--warn">{error}</p>}
    </>
  )
}
