// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { CSSProperties } from 'react'
import Link from 'next/link'
import type { ChannelDirectoryEntry } from '@tahti/shared'
import { AvatarTile } from '@tahti/ui'
import { resolveChannelUrl } from '@/lib/app-url'

function cardBgStyle(avatarUrl: string | null | undefined): CSSProperties | undefined {
  return avatarUrl ? ({ '--card-bg-image': `url(${avatarUrl})` } as CSSProperties) : undefined
}

const PREVIEW_COUNT = 12

/** Always-visible artist preview on /listen — separate from the searchable
 * "Artists & genres" tab (DiscoverTabs), which stays the place to browse the
 * full directory. This is just enough to make artists discoverable without a
 * tab click, each card linking straight to that artist's channel page. */
export function ArtistsSection({ items }: { items: ChannelDirectoryEntry[] }) {
  if (items.length === 0) return null

  const preview = [...items]
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
    .slice(0, PREVIEW_COUNT)

  return (
    <section className="listen-artists-section">
      <div className="listen-artists-section__header">
        <h2 className="listen-artists-section__title">Artists</h2>
        {items.length > preview.length && (
          <span className="listen-artists-section__count">{items.length} on Tahti</span>
        )}
      </div>
      <ul className="artist-directory__grid">
        {preview.map((item) => (
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
    </section>
  )
}
