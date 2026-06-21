'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useEffect, useState } from 'react'
import NextLink from 'next/link'
import { BrandButton } from '@tahti/ui'
import { EndBroadcastBtn } from './end-broadcast-btn'

type LastBroadcast = { title: string; ago: string }

type Props = {
  slug: string
  goneLiveAt: string | null
  lastBroadcast: LastBroadcast | null
}

function formatElapsed(totalSec: number): string {
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

function elapsedSecondsSince(goneLiveAt: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(goneLiveAt).getTime()) / 1000))
}

/** Channel home hero — giant Go live CTA when offline, live status + ticking clock when on air. */
export function ChannelHero({ slug, goneLiveAt, lastBroadcast }: Props) {
  const [listeners, setListeners] = useState<number | null>(null)
  const [elapsedSec, setElapsedSec] = useState(() =>
    goneLiveAt ? elapsedSecondsSince(goneLiveAt) : 0,
  )

  useEffect(() => {
    if (!goneLiveAt) return
    const id = setInterval(() => setElapsedSec(elapsedSecondsSince(goneLiveAt)), 1000)
    return () => clearInterval(id)
  }, [goneLiveAt])

  useEffect(() => {
    if (!goneLiveAt) return
    let cancelled = false
    const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001'
    const poll = async () => {
      try {
        const res = await fetch(`${apiBase}/api/channels/${slug}/presence`)
        if (!res.ok || cancelled) return
        const data = (await res.json()) as { numClients: number }
        setListeners(data.numClients)
      } catch {
        // ignore — listener count is best-effort
      }
    }
    void poll()
    const id = setInterval(poll, 30_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [slug, goneLiveAt])

  if (goneLiveAt) {
    return (
      <div className="db-hero db-hero--live">
        <div className="db-hero__live-status">
          <span className="signal-dot db-hero__pulse-dot" aria-hidden />
          <span className="db-hero__live-label">LIVE NOW</span>
        </div>
        <div className="db-hero__live-meta">
          {listeners != null ? `${listeners} listener${listeners === 1 ? '' : 's'} · ` : ''}
          {formatElapsed(elapsedSec)}
        </div>
        <div className="db-hero__actions">
          <EndBroadcastBtn />
          <NextLink href={`/c/${slug}`} className="db-hero__secondary-link">
            View channel →
          </NextLink>
        </div>
      </div>
    )
  }

  return (
    <div className="db-hero db-hero--offline">
      <BrandButton as="a" href="/dashboard/broadcast" className="db-hero__go-live-btn">
        Go live →
      </BrandButton>
      <p className="db-hero__hint">Configure your broadcasting tool and start streaming.</p>
      {lastBroadcast ? (
        <p className="db-hero__last-broadcast">
          Last broadcast: {lastBroadcast.title}, {lastBroadcast.ago}
        </p>
      ) : null}
    </div>
  )
}
