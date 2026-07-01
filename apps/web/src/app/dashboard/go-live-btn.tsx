'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { BrandButton } from '@tahti/ui'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { goLive } from './actions'

export function GoLiveBtn() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleClick() {
    setLoading(true)
    try {
      const result = await goLive()
      if (result.ok) {
        router.refresh()
      } else {
        alert(result.error ?? 'Could not go live')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <BrandButton variant="primary" onClick={handleClick} disabled={loading} aria-label="Go live">
      {loading ? 'Going live…' : '● Go live'}
    </BrandButton>
  )
}
