// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'

const ArchiveEditor = dynamic(() => import('../archive-editor'))

type ArchiveListItem = Record<string, unknown> & {
  id: string
  title: string
  status: string
  isPublic?: boolean
}

interface PlayableItem {
  id: string
  audioUrl: string | null
}

type StatusFilter = 'all' | 'unpublished' | 'drafts' | 'published'

function itemFilter(item: ArchiveListItem): StatusFilter {
  if (item.status !== 'READY') return 'drafts'
  return item.isPublic === false ? 'unpublished' : 'published'
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
}: {
  items: ArchiveListItem[]
  playable: PlayableItem[]
  mixcloudConnected: boolean
  mixcloudConfigured: boolean
  apiUrl: string
  channelSlug: string | null
}) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<StatusFilter>('all')

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
    return items.filter((item) => {
      if (filter !== 'all' && itemFilter(item) !== filter) return false
      if (q && !item.title.toLowerCase().includes(q)) return false
      return true
    })
  }, [items, search, filter])

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
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search archive…"
          className="studio-input archive-list__search"
        />
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
                  {play?.audioUrl && (
                    <audio
                      controls
                      src={play.audioUrl}
                      className="studio-audio-full"
                      data-testid="dashboard-archive-player"
                    />
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
