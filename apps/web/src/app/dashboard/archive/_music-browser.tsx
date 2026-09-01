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
  embedUri?: string | null
  embedProvider?: string | null
}

interface PlayableItem {
  id: string
  title: string
  artistName: string | null
  audioUrl: string | null
  embedProvider: string | null
  embedUri: string | null
  bannerUrl: string | null
  peaks: number[] | null
  visualPreset: string | null
  accentColor: string | null
  repostToDownload: boolean
  followToDownload: boolean
  commentCount: number
  downloadCount: number
}

export interface AlbumSummary {
  id: string
  title: string
  type: string
  state: string
  releaseDate: string
  artworkUrl?: string | null
  smartLinkSlug: string
  pinnedAt?: string | null
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

// DJ_SET/LIVE/SHOW read as "played out" recordings; everything else
// (tracks, podcasts, remixes) is a plain Track.
const DJ_SET_CONTENT_TYPES = new Set(['DJ_SET', 'LIVE', 'SHOW'])

type MusicTab = 'tracks' | 'albums' | 'dj-sets' | 'collections' | 'embeds'

const EMBED_PROVIDER_ORDER = ['HEARTHIS', 'SPOTIFY', 'MIXCLOUD'] as const
const EMBED_PROVIDER_LABELS: Record<string, string> = {
  HEARTHIS: 'hearthis.at',
  SPOTIFY: 'Spotify',
  MIXCLOUD: 'Mixcloud',
}

export function MusicBrowser({
  items,
  playable,
  albums,
  collections,
  mixcloudConnected,
  mixcloudConfigured,
  apiUrl,
  channelSlug,
  artistUsername,
}: {
  items: ArchiveListItem[]
  playable: PlayableItem[]
  albums: AlbumSummary[]
  collections: CollectionSummary[]
  mixcloudConnected: boolean
  mixcloudConfigured: boolean
  apiUrl: string
  channelSlug: string | null
  artistUsername: string
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

  const embedsByProvider = useMemo(() => {
    const byProvider = new Map<string, ArchiveListItem[]>()
    for (const item of items) {
      if (!item.embedUri) continue
      const provider = item.embedProvider ?? 'OTHER'
      const list = byProvider.get(provider) ?? []
      list.push(item)
      byProvider.set(provider, list)
    }
    return byProvider
  }, [items])
  const embedCount = useMemo(
    () => [...embedsByProvider.values()].reduce((sum, list) => sum + list.length, 0),
    [embedsByProvider],
  )
  const embedProviders = [
    ...EMBED_PROVIDER_ORDER.filter((p) => embedsByProvider.has(p)),
    ...[...embedsByProvider.keys()].filter(
      (p) => !(EMBED_PROVIDER_ORDER as readonly string[]).includes(p),
    ),
  ]

  const tabs: Array<{ id: MusicTab; label: string; count: number; accent: string }> = [
    { id: 'tracks', label: 'Sounds', count: tracks.length, accent: 'cyan' },
    { id: 'collections', label: 'Collections', count: collections.length, accent: 'green' },
    { id: 'albums', label: 'Releases', count: albums.length, accent: 'purple' },
    { id: 'embeds', label: 'Embeds', count: embedCount, accent: 'pink' },
    { id: 'dj-sets', label: 'Shows', count: djSets.length, accent: 'amber' },
  ]

  return (
    <div className="music-browser">
      <nav className="music-browser__nav" aria-label="Music sections">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`music-browser__nav-item music-browser__nav-item--${t.accent}${tab === t.id ? ' music-browser__nav-item--active' : ''}`}
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
              artistUsername={artistUsername}
              showEmbedFilter
            />
          ))}

        {tab === 'dj-sets' &&
          (djSets.length === 0 ? (
            <p className="studio-text-muted-sm">No tracks, DJ sets, or radio shows yet.</p>
          ) : (
            <ArchiveList
              items={djSets}
              playable={playable}
              mixcloudConnected={mixcloudConnected}
              mixcloudConfigured={mixcloudConfigured}
              apiUrl={apiUrl}
              channelSlug={channelSlug}
              artistUsername={artistUsername}
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

        {tab === 'embeds' &&
          (embedCount === 0 ? (
            <p className="studio-text-muted-sm">
              No embedded tracks yet — items imported from hearthis.at, Spotify, or Mixcloud show up
              here, grouped by service.
            </p>
          ) : (
            embedProviders.map((provider) => (
              <div key={provider} className="music-browser__embed-group">
                <div className="music-browser__embed-group-label">
                  {EMBED_PROVIDER_LABELS[provider] ?? provider}
                </div>
                <ArchiveList
                  items={embedsByProvider.get(provider) ?? []}
                  playable={playable}
                  mixcloudConnected={mixcloudConnected}
                  mixcloudConfigured={mixcloudConfigured}
                  apiUrl={apiUrl}
                  channelSlug={channelSlug}
                  artistUsername={artistUsername}
                />
              </div>
            ))
          ))}
      </div>
    </div>
  )
}
