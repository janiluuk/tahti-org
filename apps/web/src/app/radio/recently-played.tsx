// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import Link from 'next/link'
import { AvatarTile } from '@tahti/ui'

export interface RecentlyPlayedItem {
  id: string
  title: string
  artistName: string
  /** Null for curated/compilation tracks (e.g. Tahti Selects' CC0 rotation)
   * with no real Tahti profile to link the artist name to. */
  artistUsername: string | null
  artworkUrl: string | null
  playedAt: string
}

function formatAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

/** Radio page, below the player — what actually played previously, most
 * recent first (distinct from the "Upcoming shows" bookings and the "in the
 * rotation" set order shown in the Schedule & rotation overlay). */
export function RecentlyPlayed({ items }: { items: RecentlyPlayedItem[] }) {
  if (items.length === 0) return null

  return (
    <section className="ch-radio-recent">
      <h2 className="ch-radio-recent__title">Recently played</h2>
      <ul className="ch-radio-recent__list">
        {items.map((item) => (
          <li key={item.id} className="ch-radio-recent__item">
            {item.artworkUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.artworkUrl} alt="" className="ch-radio-recent__art" />
            ) : (
              <AvatarTile size="sm" name={item.title} className="ch-radio-recent__art" />
            )}
            <div className="ch-radio-recent__body">
              <span className="ch-radio-recent__song">{item.title}</span>
              {item.artistUsername ? (
                <Link href={`/u/${item.artistUsername}`} className="ch-radio-recent__artist">
                  {item.artistName}
                </Link>
              ) : (
                <span className="ch-radio-recent__artist">{item.artistName}</span>
              )}
            </div>
            <span className="ch-radio-recent__time">{formatAgo(item.playedAt)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
