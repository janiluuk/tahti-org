'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'
import { AvatarTile } from '@tahti/ui'

export interface RecentlyPlayedChannel {
  channelId: string
  slug: string
  artistName: string
  featuredAt: string
}

function formatAgo(iso: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000))
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return `${Math.floor(days / 7)}w ago`
}

export function RecentlyPlayedChannels({ items }: { items: RecentlyPlayedChannel[] }) {
  if (items.length === 0) return null

  return (
    <section className="ch-radio-recent-channels" aria-labelledby="recent-radio-channels-title">
      <div className="ch-radio-recent-channels__header">
        <h2 id="recent-radio-channels-title">Recently on air</h2>
        <span>Last featured channels</span>
      </div>
      <div className="ch-radio-recent-channels__slider" tabIndex={0}>
        {items.map((item) => (
          <Link
            key={`${item.channelId}-${item.featuredAt}`}
            href={`/radio/show/${encodeURIComponent(item.slug)}`}
            className="ch-radio-recent-channels__card"
          >
            <AvatarTile
              size="sm"
              name={item.artistName}
              className="ch-radio-recent-channels__avatar"
            />
            <span className="ch-radio-recent-channels__body">
              <strong>{item.artistName}</strong>
              <span>@{item.slug}</span>
            </span>
            <time dateTime={item.featuredAt}>{formatAgo(item.featuredAt)}</time>
          </Link>
        ))}
      </div>
    </section>
  )
}
