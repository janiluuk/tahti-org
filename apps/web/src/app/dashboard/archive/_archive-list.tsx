// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { ArchiveItemPlayback } from '@/components/archive-item-playback'
import type { PlayerTrack } from '@/contexts/player-context'

const ArchiveEditor = dynamic(() => import('../archive-editor'))

type ArchiveListItem = Record<string, unknown> & {
  id: string
  title: string
  status: string
  isPublic?: boolean
  pinnedAt?: string | null
  createdAt?: string
}

interface PlayableItem {
  id: string
  title: string
  artistName: string | null
  audioUrl: string | null
  bannerUrl: string | null
  peaks: number[] | null
  visualPreset: string | null
  accentColor: string | null
  repostToDownload: boolean
  followToDownload: boolean
  commentCount: number
  downloadCount: number
}

type StatusFilter = 'all' | 'unpublished' | 'drafts' | 'published'

type SortKey = 'newest' | 'oldest' | 'title-asc' | 'title-desc'

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'title-asc', label: 'Title A–Z' },
  { value: 'title-desc', label: 'Title Z–A' },
]

function itemFilter(item: ArchiveListItem): StatusFilter {
  if (item.status !== 'READY') return 'drafts'
  return item.isPublic === false ? 'unpublished' : 'published'
}

function sortItems(items: ArchiveListItem[], sort: SortKey): ArchiveListItem[] {
  const sorted = [...items].sort((a, b) => {
    switch (sort) {
      case 'title-asc':
        return a.title.localeCompare(b.title)
      case 'title-desc':
        return b.title.localeCompare(a.title)
      case 'oldest':
        return new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime()
      case 'newest':
      default:
        return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
    }
  })
  // Pinned tracks float to the top regardless of sort, most-recently-pinned
  // first — same rule as the public Stage tab (ArchiveItem.pinnedAt).
  return sorted.sort((a, b) => {
    const aPinned = a.pinnedAt ? new Date(a.pinnedAt).getTime() : 0
    const bPinned = b.pinnedAt ? new Date(b.pinnedAt).getTime() : 0
    if (aPinned === 0 && bPinned === 0) return 0
    return bPinned - aPinned
  })
}

/** Small deterministic decorative color per item — not a meaning-bound brand
 * token, just a stable hue so rows are visually distinguishable in a long list. */
function swatchColor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  const hue = hash % 360
  return `hsl(${hue}, 55%, 55%)`
}

export function ArchiveList({
  items,
  playable,
  mixcloudConnected,
  mixcloudConfigured,
  apiUrl,
  channelSlug,
  artistUsername,
}: {
  items: ArchiveListItem[]
  playable: PlayableItem[]
  mixcloudConnected: boolean
  mixcloudConfigured: boolean
  apiUrl: string
  channelSlug: string | null
  artistUsername: string
}) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [sort, setSort] = useState<SortKey>('newest')

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = {
      all: items.length,
      unpublished: 0,
      drafts: 0,
      published: 0,
    }
    for (const item of items) c[itemFilter(item)]++
    return c
  }, [items])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    const matched = items.filter((item) => {
      if (filter !== 'all' && itemFilter(item) !== filter) return false
      if (q && !item.title.toLowerCase().includes(q)) return false
      return true
    })
    return sortItems(matched, sort)
  }, [items, search, filter, sort])

  // Shared play queue, in display order — lets playback auto-advance to the
  // next track on 'ended' instead of just stopping, same as public listings.
  const queue: PlayerTrack[] = useMemo(
    () =>
      visible
        .map((item) => playable.find((p) => p.id === item.id))
        .filter((p): p is PlayableItem => Boolean(p?.audioUrl))
        .map((p) => ({
          id: p.id,
          kind: 'archive' as const,
          url: p.audioUrl!,
          title: p.title,
          subtitle: p.artistName?.trim() || `@${artistUsername}`,
          artworkUrl: p.bannerUrl,
        })),
    [visible, playable, artistUsername],
  )

  return (
    <div>
      <div className="archive-list__toolbar">
        <div className="archive-list__filters">
          {(['all', 'unpublished', 'drafts', 'published'] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`archive-list__filter${filter === key ? ' archive-list__filter--active' : ''}`}
            >
              {key === 'all' ? 'All' : key.charAt(0).toUpperCase() + key.slice(1)} ({counts[key]})
            </button>
          ))}
        </div>
        <div className="archive-list__toolbar-right">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="studio-input archive-list__sort"
            aria-label="Sort archive"
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
            placeholder="Search archive…"
            className="studio-input archive-list__search"
          />
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="studio-text-muted-sm studio-mt-md">No recordings match.</p>
      ) : (
        <ul className="studio-list studio-mt-sm">
          {visible.map((item) => {
            const play = playable.find((a) => a.id === item.id)
            return (
              <li key={item.id} className="archive-list__row">
                <div
                  className="archive-list__swatch"
                  style={{ background: swatchColor(item.id) }}
                  aria-hidden
                />
                <div className="archive-list__row-body">
                  <ArchiveEditor
                    item={item}
                    mixcloudConnected={mixcloudConnected}
                    mixcloudConfigured={mixcloudConfigured}
                    apiUrl={apiUrl}
                    channelSlug={channelSlug}
                  />
                  {channelSlug && play?.audioUrl && (
                    // ArchiveItemPlayback's classes (ch-archive-*, waveform bars, action
                    // pill colors) are only styled under the public "brand" design system —
                    // the dashboard is scoped "studio", so without this wrapper the waveform
                    // bars render with no size/color at all and only the background particle
                    // visualizer is visible. Same fix mini-player.tsx uses to work everywhere.
                    <div data-tahti-ui="brand">
                      <ArchiveItemPlayback
                        channelSlug={channelSlug}
                        artistUsername={artistUsername}
                        artistCredit={play.artistName}
                        item={{
                          id: play.id,
                          title: play.title,
                          audioUrl: play.audioUrl,
                          bannerUrl: play.bannerUrl,
                          peaks: play.peaks,
                          visualPreset: play.visualPreset,
                          repostToDownload: play.repostToDownload,
                          followToDownload: play.followToDownload,
                          commentCount: play.commentCount,
                          downloadCount: play.downloadCount,
                          accentColor: play.accentColor,
                        }}
                        isLoggedIn
                        queue={queue}
                      />
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
