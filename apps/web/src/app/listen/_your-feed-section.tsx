// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { FeedItem } from '@tahti/shared'
import { ArtistFeedSection } from '@/app/dashboard/_artist-feed-section'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001'

interface FeedData {
  items: FeedItem[]
  followingCount: number
}

/** Was embedded on the artist dashboard ("so artists don't need a separate
 * nav item just to see what artists they follow posted") — moved here since
 * following/being followed isn't an artist-only concept, and a listener with
 * no channel had no equivalent way to see it at all. */
export function YourFeedSection() {
  const [data, setData] = useState<FeedData | null>(null)
  const [signedIn, setSignedIn] = useState(true)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/me/feed`, { credentials: 'include' })
        if (cancelled) return
        if (res.status === 401) {
          setSignedIn(false)
        } else if (res.ok) {
          setData((await res.json()) as FeedData)
        }
      } catch {
        /* leave empty */
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <section className="listen-your-feed" aria-busy="true">
        <div className="listen-your-feed__header">
          <h2 className="listen-your-feed__title">Your feed</h2>
        </div>
        <p className="listen-your-feed__hint">Loading…</p>
      </section>
    )
  }

  if (!signedIn) {
    return (
      <section className="listen-your-feed">
        <div className="listen-your-feed__header">
          <h2 className="listen-your-feed__title">Your feed</h2>
        </div>
        <p className="listen-your-feed__hint">
          <Link href="/login?next=/listen">Sign in</Link> to see posts, tracks, and releases from
          artists you follow.
        </p>
      </section>
    )
  }

  return (
    <section className="listen-your-feed">
      <div className="listen-your-feed__header">
        <h2 className="listen-your-feed__title">Your feed</h2>
      </div>
      <ArtistFeedSection items={data?.items ?? []} followingCount={data?.followingCount ?? 0} />
    </section>
  )
}
