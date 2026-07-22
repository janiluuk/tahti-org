// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { ChannelDirectoryEntry } from '@tahti/shared'
import { AvatarTile } from '@tahti/ui'

export function ArtistDirectory({ items }: { items: ChannelDirectoryEntry[] }) {
  const [query, setQuery] = useState('')
  const [genre, setGenre] = useState<string | null>(null)

  const genres = useMemo(() => {
    const set = new Set<string>()
    for (const item of items) for (const g of item.genres) set.add(g)
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [items])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items
      .filter((item) => !genre || item.genres.includes(genre))
      .filter((item) => !q || item.displayName.toLowerCase().includes(q) || item.slug.includes(q))
      .sort((a, b) => a.displayName.localeCompare(b.displayName))
  }, [items, query, genre])

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
        <ul className="artist-directory__grid">
          {filtered.map((item) => (
            <li key={item.slug}>
              <Link href={`/c/${item.slug}`} className="artist-directory__card">
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
      )}
    </div>
  )
}
