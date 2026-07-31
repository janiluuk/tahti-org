// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { NewToYouResponse } from '@tahti/shared'
import { SelectsGallery } from './_selects-gallery'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001'

export function NewToYouSection() {
  const [data, setData] = useState<NewToYouResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/discover/new-to-you`, {
          credentials: 'include',
        })
        if (!cancelled && res.ok) {
          setData((await res.json()) as NewToYouResponse)
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
      <section className="listen-new-to-you" aria-busy="true">
        <div className="listen-new-to-you__header">
          <h2 className="listen-new-to-you__title">New to you</h2>
        </div>
        <p className="listen-new-to-you__hint">Finding tracks…</p>
      </section>
    )
  }

  if (!data?.authenticated) {
    return (
      <section className="listen-new-to-you">
        <div className="listen-new-to-you__header">
          <h2 className="listen-new-to-you__title">New to you</h2>
        </div>
        <p className="listen-new-to-you__hint">
          <Link href="/login?next=/listen">Sign in</Link> to see unheard tracks that match genres
          you already listen to and artists you follow.
        </p>
      </section>
    )
  }

  if (data.items.length === 0) {
    return (
      <section className="listen-new-to-you">
        <div className="listen-new-to-you__header">
          <h2 className="listen-new-to-you__title">New to you</h2>
        </div>
        <p className="listen-new-to-you__hint">
          Nothing new right now — keep listening and following artists, and we&apos;ll surface
          unheard tracks in your genres here.
        </p>
      </section>
    )
  }

  const subtitle =
    data.preferenceGenres.length > 0
      ? `Unheard tracks matching ${data.preferenceGenres.slice(0, 3).join(', ')}`
      : 'Unheard tracks from artists on Tahti'

  return (
    <section className="listen-new-to-you">
      <div className="listen-new-to-you__header">
        <h2 className="listen-new-to-you__title">New to you</h2>
        <span className="listen-new-to-you__count">{subtitle}</span>
      </div>
      <SelectsGallery items={data.items} />
    </section>
  )
}
