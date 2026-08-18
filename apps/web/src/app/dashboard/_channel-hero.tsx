'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useEffect, useState } from 'react'
import NextLink from 'next/link'
import { BrandButton } from '@tahti/ui'
import { GoLiveBtn } from './go-live-btn'
import { StreamManagerPanel } from './_stream-manager-panel'

type LastBroadcast = { title: string; ago: string }

type Props = {
  slug: string
  state: string
  goneLiveAt: string | null
  broadcastTitle: string | null
  lastBroadcast: LastBroadcast | null
  displayName?: string
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
export function ChannelHero({
  slug,
  state,
  goneLiveAt,
  broadcastTitle,
  lastBroadcast,
  displayName,
}: Props) {
  const [elapsedSec, setElapsedSec] = useState(() =>
    goneLiveAt ? elapsedSecondsSince(goneLiveAt) : 0,
  )

  useEffect(() => {
    if (!goneLiveAt) return
    const id = setInterval(() => setElapsedSec(elapsedSecondsSince(goneLiveAt)), 1000)
    return () => clearInterval(id)
  }, [goneLiveAt])

  if (goneLiveAt) {
    return (
      <div className="db-hero db-hero--live" data-hero>
        <div className="db-hero__live-status">
          <span className="signal-dot db-hero__pulse-dot" aria-hidden />
          <span className="db-hero__live-label">LIVE NOW · {formatElapsed(elapsedSec)}</span>
        </div>
        {broadcastTitle ? <div className="db-hero__show-name">{broadcastTitle}</div> : null}
        <StreamManagerPanel slug={slug} displayName={displayName} />
      </div>
    )
  }

  if (state === 'PREVIEW') {
    return (
      <div className="db-hero db-hero--preview" data-hero>
        <div className="db-hero__live-status">
          <span className="db-hero__pulse-dot db-hero__pulse-dot--preview" aria-hidden />
          <span className="db-hero__live-label">PREVIEW — only you can hear this</span>
        </div>
        <div className="db-hero__actions">
          <GoLiveBtn />
          <NextLink href="/dashboard/broadcast" className="db-hero__secondary-link">
            Open broadcast studio →
          </NextLink>
        </div>
      </div>
    )
  }

  return (
    <div className="db-hero db-hero--offline" data-hero>
      <div className="db-hero__eyebrow">Your channel is offline</div>
      <div className="db-hero__headline">Ready to broadcast?</div>
      <p className="db-hero__hint">Configure your broadcasting tool and start streaming.</p>
      {lastBroadcast ? (
        <p className="db-hero__last-broadcast">
          Last broadcast: {lastBroadcast.title}, {lastBroadcast.ago}
        </p>
      ) : null}
      <BrandButton as="a" href="/dashboard/broadcast" className="db-hero__go-live-btn">
        Go live →
      </BrandButton>
    </div>
  )
}
