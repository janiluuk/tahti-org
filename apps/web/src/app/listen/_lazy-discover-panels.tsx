// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useState } from 'react'
import type { ChannelDirectoryEntry, TahtiSelectsGalleryItem } from '@tahti/shared'
import { resolveClientApiUrl } from '@/lib/api-url'
import { ArtistDirectory } from './_artist-directory'
import { SelectsGallery } from './_selects-gallery'

function LoadingHint({ children }: { children: string }) {
  return <p className="public-empty-card__hint">{children}</p>
}

export function LazyArtistDirectory() {
  const [items, setItems] = useState<ChannelDirectoryEntry[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`${resolveClientApiUrl()}/api/v1/channels/directory`)
        if (!res.ok) throw new Error('directory')
        const data = (await res.json()) as { items: ChannelDirectoryEntry[] }
        if (!cancelled) setItems(data.items)
      } catch {
        if (!cancelled) setError(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (error) return <LoadingHint>Couldn’t load artists. Try again in a moment.</LoadingHint>
  if (!items) return <LoadingHint>Loading artists…</LoadingHint>
  return <ArtistDirectory items={items} />
}

export function LazySelectsGallery() {
  const [items, setItems] = useState<TahtiSelectsGalleryItem[] | null>(null)
  const [ranks, setRanks] = useState<Record<string, number>>({})
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`${resolveClientApiUrl()}/api/v1/tahti-selects/gallery`)
        if (!res.ok) throw new Error('gallery')
        const data = (await res.json()) as { items: TahtiSelectsGalleryItem[] }
        if (cancelled) return
        setItems(data.items)
        const ids = data.items.map((item) => item.soundId)
        if (ids.length === 0) return
        const rankRes = await fetch(
          `${resolveClientApiUrl()}/api/top-lists/ranks?ids=${ids.join(',')}`,
        )
        if (!rankRes.ok || cancelled) return
        const rankData = (await rankRes.json()) as { ranks: Record<string, number> }
        if (!cancelled) setRanks(rankData.ranks)
      } catch {
        if (!cancelled) setError(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (error) return <LoadingHint>Couldn’t load Tahti Selects. Try again in a moment.</LoadingHint>
  if (!items) return <LoadingHint>Loading Tahti Selects…</LoadingHint>
  return <SelectsGallery items={items} ranks={ranks} />
}
