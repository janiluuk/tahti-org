'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useState } from 'react'
import { Alert } from '@tahti/ui'
import { usePathname, useRouter } from 'next/navigation'
import NextLink from 'next/link'
import { goLive } from './actions'

/** The dashboard header's go-live pill, shown on the artist studio page.
 * PREVIEW goes straight to LIVE. OFFLINE links to the broadcast studio.
 * LIVE links to Studio overview (this page when already there), where the
 * stream manager lives — not a modal off the Go live control. */
export function HeaderGoLiveAction({
  state,
  className,
  dotClassName,
  label,
}: {
  state: string | undefined
  className: string
  dotClassName: string
  label: string
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const pathname = usePathname()

  if (state === 'LIVE') {
    if (pathname === '/dashboard') {
      return (
        <span className={className}>
          <span className={dotClassName} aria-hidden style={{ width: 6, height: 6 }} />
          {label}
        </span>
      )
    }
    return (
      <NextLink href="/dashboard" className={className}>
        <span className={dotClassName} aria-hidden style={{ width: 6, height: 6 }} />
        {label}
      </NextLink>
    )
  }

  if (state !== 'PREVIEW') {
    return (
      <NextLink href="/dashboard/broadcast" className={className}>
        <span className={dotClassName} aria-hidden style={{ width: 6, height: 6 }} />
        {label}
      </NextLink>
    )
  }

  async function handleClick() {
    setError(null)
    setLoading(true)
    try {
      const result = await goLive()
      if (result.ok) {
        router.refresh()
      } else {
        setError(result.error ?? 'Could not go live')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        type="button"
        className={className}
        style={{ cursor: 'pointer' }}
        onClick={() => void handleClick()}
        disabled={loading}
        aria-label="Go live"
      >
        <span className={dotClassName} aria-hidden style={{ width: 6, height: 6 }} />
        {loading ? 'Going live…' : label}
      </button>
      {error && <Alert variant="error">{error}</Alert>}
    </>
  )
}
