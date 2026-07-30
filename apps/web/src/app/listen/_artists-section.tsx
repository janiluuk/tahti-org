// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useMemo, type CSSProperties } from 'react'
import Link from 'next/link'
import type { ChannelDirectoryEntry } from '@tahti/shared'
import { AvatarTile } from '@tahti/ui'
import { resolveChannelUrl } from '@/lib/app-url'
import { useInfiniteSlice } from './_use-infinite-slice'

function cardBgStyle(avatarUrl: string | null | undefined): CSSProperties | undefined {
  return avatarUrl ? ({ '--card-bg-image': `url(${avatarUrl})` } as CSSProperties) : undefined
}

const PAGE_SIZE = 12

/** Always-visible artist list on /listen — starts with a short page and loads
 * more as you scroll. The searchable "Artists & genres" tab still has filters. */
export function ArtistsSection({ items }: { items: ChannelDirectoryEntry[] }) {
  const sorted = useMemo(
    () => [...items].sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [items],
  )

  const { shown, hasMore, sentinelRef, total, visibleCount } = useInfiniteSlice(
    sorted,
    PAGE_SIZE,
    String(sorted.length),
  )

  if (items.length === 0) return null

  return (
    <section className="listen-artists-section">
      <div className="listen-artists-section__header">
        <h2 className="listen-artists-section__title">Artists</h2>
        {total > PAGE_SIZE && (
          <span className="listen-artists-section__count">{total} on Tahti</span>
        )}
      </div>
      <ul className="artist-directory__grid">
        {shown.map((item) => (
          <li key={item.slug}>
            <Link
              href={resolveChannelUrl(item.slug)}
              className="artist-directory__card"
              style={cardBgStyle(item.avatarUrl)}
            >
              {item.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.avatarUrl} alt="" className="artist-directory__avatar" />
              ) : (
                <AvatarTile
                  size="sm"
                  name={item.displayName}
                  className="artist-directory__avatar"
                />
              )}
              <span className="artist-directory__name">{item.displayName}</span>
              {item.genres.length > 0 && (
                <span className="artist-directory__genre">{item.genres[0]}</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
      <div ref={sentinelRef} className="artist-directory__scroll-status" aria-live="polite">
        {hasMore
          ? `Showing ${visibleCount} of ${total} — scroll for more`
          : total > PAGE_SIZE
            ? `All ${total} artists`
            : null}
      </div>
    </section>
  )
}
