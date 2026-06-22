'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { BrandButton } from '@tahti/ui'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { endBroadcast } from './actions'

export function EndBroadcastBtn({ mode = 'live' }: { mode?: 'live' | 'preview' }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const confirmMessage =
    mode === 'preview' ? 'Stop your preview now?' : 'End your live broadcast now?'
  const label = mode === 'preview' ? '■ Stop preview' : '■ End Broadcast'

  async function handleClick() {
    if (!confirm(confirmMessage)) return
    setLoading(true)
    try {
      const result = await endBroadcast()
      if (result.ok) {
        router.refresh()
      } else {
        alert(result.error ?? 'Could not end broadcast')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <BrandButton
      variant="warn"
      onClick={handleClick}
      disabled={loading}
      aria-label={mode === 'preview' ? 'Stop preview' : 'End live broadcast'}
    >
      {loading ? '…' : label}
    </BrandButton>
  )
}
