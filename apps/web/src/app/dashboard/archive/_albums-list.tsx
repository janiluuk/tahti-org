// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { AlbumSummary } from './_music-browser'

function formatDuration(sec: number | null): string {
  if (sec == null) return ''
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function AlbumsList({ albums }: { albums: AlbumSummary[] }) {
  const [openId, setOpenId] = useState<string | null>(null)

  return (
    <ul className="studio-list studio-mt-sm">
      {albums.map((album) => {
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
                  <span className="music-album-row__cover music-album-row__cover--ph" aria-hidden />
                )}
                <span>
                  <span className="studio-stat-box-title">{album.title}</span>
                  <span className="studio-text-muted-sm">
                    {album.type} · {album.state} · {album._count.tracks} track
                    {album._count.tracks === 1 ? '' : 's'}
                  </span>
                </span>
              </button>
              <Link
                href={`/dashboard/releases/${album.id}`}
                className="ui-btn ui-btn--sm ui-btn--secondary"
              >
                Manage →
              </Link>
            </div>

            {open && (
              <div className="studio-editor-panel">
                {album.tracks && album.tracks.length > 0 ? (
                  <ol className="music-album-tracklist">
                    {album.tracks.map((track) => (
                      <li key={track.id}>
                        <span>{track.title}</span>
                        <span className="studio-text-muted-sm">
                          {formatDuration(track.durationSec)}
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
  )
}
