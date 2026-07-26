// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { AlbumSummary } from './_music-browser'
import { AddToPlaylistButton } from '../_add-to-playlist-button'
import { updateReleasePinned } from '../release-actions'

type SortKey = 'newest' | 'oldest' | 'title-asc' | 'title-desc'

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'newest', label: 'Release date (newest)' },
  { value: 'oldest', label: 'Release date (oldest)' },
  { value: 'title-asc', label: 'Title A–Z' },
  { value: 'title-desc', label: 'Title Z–A' },
]

function sortAlbums(albums: AlbumSummary[], sort: SortKey): AlbumSummary[] {
  const sorted = [...albums].sort((a, b) => {
    switch (sort) {
      case 'title-asc':
        return a.title.localeCompare(b.title)
      case 'title-desc':
        return b.title.localeCompare(a.title)
      case 'oldest':
        return new Date(a.releaseDate).getTime() - new Date(b.releaseDate).getTime()
      case 'newest':
      default:
        return new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime()
    }
  })
  // Pinned releases float to the top regardless of sort, most-recently-pinned
  // first — same rule as the public Stage tab (Release.pinnedAt).
  return sorted.sort((a, b) => {
    const aPinned = a.pinnedAt ? new Date(a.pinnedAt).getTime() : 0
    const bPinned = b.pinnedAt ? new Date(b.pinnedAt).getTime() : 0
    if (aPinned === 0 && bPinned === 0) return 0
    return bPinned - aPinned
  })
}

function formatDuration(sec: number | null): string {
  if (sec == null) return ''
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function AlbumsList({ albums }: { albums: AlbumSummary[] }) {
  const router = useRouter()
  const [openId, setOpenId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortKey>('newest')
  const [isPending, startTransition] = useTransition()

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    const matched = q ? albums.filter((a) => a.title.toLowerCase().includes(q)) : albums
    return sortAlbums(matched, sort)
  }, [albums, search, sort])

  function togglePin(id: string, pinned: boolean) {
    startTransition(async () => {
      await updateReleasePinned(id, pinned)
      router.refresh()
    })
  }

  return (
    <div>
      <div className="archive-list__toolbar">
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="studio-input archive-list__sort"
          aria-label="Sort albums"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search albums…"
          className="studio-input archive-list__search"
        />
      </div>

      {visible.length === 0 ? (
        <p className="studio-text-muted-sm studio-mt-md">No albums match.</p>
      ) : (
        <ul className="studio-list studio-mt-sm">
          {visible.map((album) => {
            const open = openId === album.id
            return (
              <li
                key={album.id}
                className={`studio-item-row--list${open ? ' studio-item-row--list--active' : ''}`}
              >
                <div className="studio-card-row">
                  <button
                    type="button"
                    className="music-album-row"
                    onClick={() => setOpenId(open ? null : album.id)}
                    aria-expanded={open}
                  >
                    {album.artworkUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={album.artworkUrl} alt="" className="music-album-row__cover" />
                    ) : (
                      <span
                        className="music-album-row__cover music-album-row__cover--ph"
                        aria-hidden
                      />
                    )}
                    <span>
                      <span className="studio-stat-box-title">{album.title}</span>
                      <span className="studio-text-muted-sm">
                        {album.type} · {album.state} · {album._count.tracks} track
                        {album._count.tracks === 1 ? '' : 's'}
                        {album.pinnedAt && ' · Pinned'}
                      </span>
                    </span>
                  </button>
                  <div className="studio-actions studio-actions--sm">
                    {album.state === 'PUBLISHED' && (
                      <button
                        type="button"
                        onClick={() => togglePin(album.id, !album.pinnedAt)}
                        disabled={isPending}
                        className="ui-btn ui-btn--sm ui-btn--ghost"
                      >
                        {album.pinnedAt ? 'Unpin from Stage' : 'Pin to Stage'}
                      </button>
                    )}
                    <Link
                      href={`/dashboard/releases/${album.id}`}
                      className="ui-btn ui-btn--sm ui-btn--secondary"
                    >
                      Manage →
                    </Link>
                  </div>
                </div>

                {open && (
                  <div className="studio-editor-panel">
                    {album.tracks && album.tracks.length > 0 ? (
                      <ol className="music-album-tracklist">
                        {album.tracks.map((track) => (
                          <li key={track.id}>
                            <span>{track.title}</span>
                            <span className="music-album-tracklist__meta">
                              <span className="studio-text-muted-sm">
                                {formatDuration(track.durationSec)}
                              </span>
                              {track.archiveItemId && (
                                <AddToPlaylistButton archiveItemId={track.archiveItemId} />
                              )}
                              <Link
                                href={`/dashboard/insights/release-track/${track.id}`}
                                className="ui-btn ui-btn--sm ui-btn--ghost"
                              >
                                Show insights
                              </Link>
                            </span>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="studio-text-muted-sm">No tracks in this album yet.</p>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
