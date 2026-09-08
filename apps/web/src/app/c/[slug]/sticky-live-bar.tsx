'use client'

import { resolveClientApiUrl } from '@/lib/api-url'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { StickyLiveBar as StickyLiveBarUi } from '@tahti/ui'
import { useEffect, useState } from 'react'
import { resolveChannelUrl } from '@/lib/app-url'

type Props = {
  slug: string
  artistName: string
  isFlac: boolean
}

export function StickyLiveBar({ slug, artistName, isFlac }: Props) {
  const [listeners, setListeners] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    const poll = async () => {
      try {
        const apiBase = resolveClientApiUrl()
        const res = await fetch(`${apiBase}/api/channels/${slug}/presence`)
        if (!res.ok || cancelled) return
        const data = (await res.json()) as { numClients: number }
        setListeners(data.numClients)
      } catch {
        // ignore
      }
    }
    void poll()
    const id = setInterval(poll, 30_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [slug])

  return (
    <StickyLiveBarUi
      artistName={artistName}
      channelHref={`${resolveChannelUrl(slug)}#live-player`}
      listeners={listeners}
      isFlac={isFlac}
    />
  )
}
