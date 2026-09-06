'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useState } from 'react'
import Link from 'next/link'
import { AvatarTile } from '@tahti/ui'

export interface RecentlyPlayedChannel {
  channelId: string
  slug: string
  artistName: string
  featuredAt: string
}

export function formatRecentlyPlayedAgo(iso: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000))
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return `${Math.floor(days / 7)}w ago`
}

export const RECENT_CHANNELS_PEEK = 3

export function visibleRecentlyPlayedChannels<T>(
  items: T[],
  expanded: boolean,
  peek = RECENT_CHANNELS_PEEK,
): T[] {
  return expanded ? items : items.slice(0, peek)
}

export function RecentlyPlayedChannels({ items }: { items: RecentlyPlayedChannel[] }) {
  const [expanded, setExpanded] = useState(false)
  if (items.length === 0) return null

  const shown = visibleRecentlyPlayedChannels(items, expanded)
  const canExpand = items.length > RECENT_CHANNELS_PEEK

  return (
    <section className="ch-radio-recent-channels" aria-labelledby="recent-radio-channels-title">
      <div className="ch-radio-recent-channels__header">
        <h2 id="recent-radio-channels-title">Recently on air</h2>
        <span>Last featured channels</span>
      </div>
      <div className="ch-radio-recent-channels__slider" tabIndex={0}>
        {shown.map((item) => (
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
            <time dateTime={item.featuredAt}>{formatRecentlyPlayedAgo(item.featuredAt)}</time>
          </Link>
        ))}
      </div>
      {canExpand && (
        <button
          type="button"
          className="ch-radio-recent-channels__more"
          onClick={() => setExpanded((open) => !open)}
        >
          {expanded ? 'Show less' : `See all ${items.length}`}
        </button>
      )}
    </section>
  )
}
