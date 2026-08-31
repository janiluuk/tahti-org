// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { AlbumSummary } from './_music-browser'
import { AddToPlaylistButton } from '../_add-to-playlist-button'
import { updateReleasePinned } from '../release-actions'
import { LibraryBrowser } from '@/components/library/library-browser'

function formatDuration(sec: number | null): string {
  if (sec == null) return ''
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function AlbumsList({ albums }: { albums: AlbumSummary[] }) {
  const router = useRouter()
  const [openId, setOpenId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function togglePin(id: string, pinned: boolean) {
    startTransition(async () => {
      await updateReleasePinned(id, pinned)
      router.refresh()
    })
  }

  return (
    <LibraryBrowser
      items={albums}
      getTitle={(album) => album.title}
      getCreatedAt={(album) => album.releaseDate}
      getPinnedAt={(album) => album.pinnedAt}
      showStatusFilters={false}
      searchPlaceholder="Search albums…"
      emptyMessage="No albums yet."
      noMatchMessage="No albums match."
    >
      {(visible) => (
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
    </LibraryBrowser>
  )
}
