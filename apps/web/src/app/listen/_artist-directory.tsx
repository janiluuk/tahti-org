// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useMemo, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import type { ChannelDirectoryEntry } from '@tahti/shared'
import { AvatarTile } from '@tahti/ui'
import { resolveChannelUrl } from '@/lib/app-url'
import { useInfiniteSlice } from './_use-infinite-slice'

function cardBgStyle(avatarUrl: string | null | undefined): CSSProperties | undefined {
  return avatarUrl ? ({ '--card-bg-image': `url(${avatarUrl})` } as CSSProperties) : undefined
}

const PAGE_SIZE = 24

export function ArtistDirectory({ items }: { items: ChannelDirectoryEntry[] }) {
  const [query, setQuery] = useState('')
  const [genre, setGenre] = useState<string | null>(null)
  const [activeOnly, setActiveOnly] = useState(false)

  const genres = useMemo(() => {
    const set = new Set<string>()
    for (const item of items) for (const g of item.genres) set.add(g)
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [items])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items
      .filter((item) => !genre || item.genres.includes(genre))
      .filter((item) => !activeOnly || item.isActive)
      .filter((item) => !q || item.displayName.toLowerCase().includes(q) || item.slug.includes(q))
      .sort((a, b) => {
        // Active (live/replaying) artists surface first — inactive ones are
        // still browsable here, just tagged, per Discover's own "only show
        // active channels" rule for the main Live tab.
        if (a.isActive !== b.isActive) return a.isActive ? -1 : 1
        return a.displayName.localeCompare(b.displayName)
      })
  }, [items, query, genre, activeOnly])

  const resetKey = `${genre ?? ''}|${query}|${filtered.length}`
  const { shown, hasMore, sentinelRef, total, visibleCount } = useInfiniteSlice(
    filtered,
    PAGE_SIZE,
    resetKey,
  )

  return (
    <div className="artist-directory">
      <div className="artist-directory__controls">
        <input
          type="text"
          className="artist-directory__search"
          placeholder="Search artists…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search artists"
        />
        <div className="listen-genre-filter" role="group" aria-label="Filter by activity">
          <button
            type="button"
            className={`listen-genre-filter__chip${activeOnly ? ' listen-genre-filter__chip--active' : ''}`}
            onClick={() => setActiveOnly((v) => !v)}
          >
            Active now
          </button>
        </div>
        {genres.length > 0 && (
          <div className="listen-genre-filter" role="group" aria-label="Filter by genre">
            <button
              type="button"
              className={`listen-genre-filter__chip${genre === null ? ' listen-genre-filter__chip--active' : ''}`}
              onClick={() => setGenre(null)}
            >
              All genres
            </button>
            {genres.map((g) => (
              <button
                key={g}
                type="button"
                className={`listen-genre-filter__chip${genre === g ? ' listen-genre-filter__chip--active' : ''}`}
                onClick={() => setGenre(genre === g ? null : g)}
              >
                {g}
              </button>
            ))}
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="public-empty-card__hint">No artists match that search.</p>
      ) : (
        <>
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
                    <img
                      src={item.avatarUrl}
                      alt=""
                      loading="lazy"
                      className="artist-directory__avatar"
                    />
                  ) : (
                    <AvatarTile
                      size="sm"
                      name={item.displayName}
                      className="artist-directory__avatar"
                    />
                  )}
                  <span className="artist-directory__name">{item.displayName}</span>
                  {item.isActive && (
                    <span className="artist-directory__active-badge">● Active</span>
                  )}
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
        </>
      )}
    </div>
  )
}
