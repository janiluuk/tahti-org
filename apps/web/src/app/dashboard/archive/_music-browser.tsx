// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useMemo, useState } from 'react'
import { ArchiveList } from './_archive-list'
import { AlbumsList } from './_albums-list'
import { CollectionsGrid } from '../collections/_collections-grid'

type ArchiveListItem = Record<string, unknown> & {
  id: string
  title: string
  status: string
  contentType?: string
  isPublic?: boolean
}

interface PlayableItem {
  id: string
  audioUrl: string | null
}

export interface AlbumSummary {
  id: string
  title: string
  type: string
  state: string
  releaseDate: string
  artworkUrl?: string | null
  smartLinkSlug: string
  tracks?: Array<{
    id: string
    title: string
    durationSec: number | null
    archiveItemId?: string | null
    status?: string
  }>
  _count: { tracks: number }
}

export interface CollectionSummary {
  slug: string
  name: string
  style: string
  visibility: string
  coverMode: string
  coverUrl: string | null
  publicProfileOrder: number
  itemCount: number
  itemCovers: string[]
}

// DJ_MIX/LIVE/RADIO_SHOW read as "played out" recordings; everything else
// (studio takes, podcasts, originals, remixes) is a plain Track.
const DJ_SET_CONTENT_TYPES = new Set(['DJ_MIX', 'LIVE', 'RADIO_SHOW'])

type MusicTab = 'tracks' | 'albums' | 'dj-sets' | 'collections'

export function MusicBrowser({
  items,
  playable,
  albums,
  collections,
  mixcloudConnected,
  mixcloudConfigured,
  apiUrl,
  channelSlug,
}: {
  items: ArchiveListItem[]
  playable: PlayableItem[]
  albums: AlbumSummary[]
  collections: CollectionSummary[]
  mixcloudConnected: boolean
  mixcloudConfigured: boolean
  apiUrl: string
  channelSlug: string | null
}) {
  const [tab, setTab] = useState<MusicTab>('tracks')

  const { tracks, djSets } = useMemo(() => {
    const tracks: ArchiveListItem[] = []
    const djSets: ArchiveListItem[] = []
    for (const item of items) {
      if (item.contentType && DJ_SET_CONTENT_TYPES.has(item.contentType)) {
        djSets.push(item)
      } else {
        tracks.push(item)
      }
    }
    return { tracks, djSets }
  }, [items])

  const tabs: Array<{ id: MusicTab; label: string; count: number }> = [
    { id: 'tracks', label: 'Tracks', count: tracks.length },
    { id: 'albums', label: 'Albums', count: albums.length },
    { id: 'dj-sets', label: 'DJ Sets', count: djSets.length },
    { id: 'collections', label: 'Collections', count: collections.length },
  ]

  return (
    <div className="music-browser">
      <nav className="music-browser__nav" aria-label="Music sections">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`music-browser__nav-item${tab === t.id ? ' music-browser__nav-item--active' : ''}`}
          >
            <span>{t.label}</span>
            <span className="music-browser__nav-count">{t.count}</span>
          </button>
        ))}
      </nav>

      <div className="music-browser__panel">
        {tab === 'tracks' &&
          (tracks.length === 0 ? (
            <p className="studio-text-muted-sm">No tracks yet.</p>
          ) : (
            <ArchiveList
              items={tracks}
              playable={playable}
              mixcloudConnected={mixcloudConnected}
              mixcloudConfigured={mixcloudConfigured}
              apiUrl={apiUrl}
              channelSlug={channelSlug}
            />
          ))}

        {tab === 'dj-sets' &&
          (djSets.length === 0 ? (
            <p className="studio-text-muted-sm">No DJ sets, live recordings, or radio shows yet.</p>
          ) : (
            <ArchiveList
              items={djSets}
              playable={playable}
              mixcloudConnected={mixcloudConnected}
              mixcloudConfigured={mixcloudConfigured}
              apiUrl={apiUrl}
              channelSlug={channelSlug}
            />
          ))}

        {tab === 'albums' &&
          (albums.length === 0 ? (
            <p className="studio-text-muted-sm">No albums yet.</p>
          ) : (
            <AlbumsList albums={albums} />
          ))}

        {tab === 'collections' &&
          (collections.length === 0 ? (
            <p className="studio-text-muted-sm">No collections yet.</p>
          ) : (
            <CollectionsGrid collections={collections} />
          ))}
      </div>
    </div>
  )
}
