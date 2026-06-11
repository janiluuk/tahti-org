'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useState, useTransition } from 'react'
import { openFanSubConnectPortal } from '../actions'

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
      <button
        type="button"
        onClick={open}
        disabled={isPending}
        className="ui-btn ui-btn--sm ui-btn--secondary"
      >
        {isPending ? 'Opening…' : 'Manage Stripe account ↗'}
      </button>
      {error && <p className="admin-footnote admin-footnote--warn">{error}</p>}
    </>
  )
}
