// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useRef, useState } from 'react'
import type { ChannelCard, ChannelDirectoryEntry, TahtiSelectsGalleryItem } from '@tahti/shared'
import { ListenChannels } from './_listen-channels'
import { ArtistDirectory } from './_artist-directory'
import { SelectsGallery } from './_selects-gallery'
import { TopListsTab } from './_top-lists-tab'

type Tab = 'live' | 'selects' | 'artists' | 'top-lists'

export function DiscoverTabs({
  live,
  replaying,
  listenerCounts,
  directory,
  gallery,
  galleryRanks,
}: {
  live: ChannelCard[]
  replaying: ChannelCard[]
  listenerCounts: Record<string, number>
  directory: ChannelDirectoryEntry[]
  gallery: TahtiSelectsGalleryItem[]
  galleryRanks: Record<string, number>
}) {
  const [tab, setTab] = useState<Tab>('live')
  // Only active (live/replaying) channels appear here — a channel that isn't
  // currently playing anything shows up in the Artists tab instead, tagged
  // as inactive rather than mixed in with what's actually on right now.
  const empty = live.length === 0 && replaying.length === 0
  const panelRefs = useRef<Record<Tab, HTMLDivElement | null>>({
    live: null,
    selects: null,
    artists: null,
    'top-lists': null,
  })

  return (
    <>
      <div className="discover-tabs" role="tablist" aria-label="Discover view">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'live'}
          data-tour="discover-tab-live"
          className={`discover-tab${tab === 'live' ? ' discover-tab--active' : ''}`}
          onClick={() => setTab('live')}
        >
          Live
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'selects'}
          data-tour="discover-tab-selects"
          className={`discover-tab${tab === 'selects' ? ' discover-tab--active' : ''}`}
          onClick={() => setTab('selects')}
        >
          Tahti Selects
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'artists'}
          data-tour="discover-tab-artists"
          className={`discover-tab${tab === 'artists' ? ' discover-tab--active' : ''}`}
          onClick={() => setTab('artists')}
        >
          Artists &amp; genres
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'top-lists'}
          data-tour="discover-tab-top-lists"
          className={`discover-tab${tab === 'top-lists' ? ' discover-tab--active' : ''}`}
          onClick={() => setTab('top-lists')}
        >
          Top lists
        </button>
      </div>

      <div
        ref={(el) => {
          panelRefs.current.live = el
        }}
      >
        {tab === 'live' &&
          (empty ? (
            <div className="public-empty-card">
              <p className="public-empty-card__text">No channels live right now.</p>
              <p className="public-empty-card__hint">
                Check the Tahti Selects or Artists tab, or check back later.
              </p>
            </div>
          ) : (
            <ListenChannels live={live} replaying={replaying} listenerCounts={listenerCounts} />
          ))}
      </div>

      <div
        ref={(el) => {
          panelRefs.current.selects = el
        }}
      >
        {tab === 'selects' && <SelectsGallery items={gallery} ranks={galleryRanks} />}
      </div>

      <div
        ref={(el) => {
          panelRefs.current.artists = el
        }}
      >
        {tab === 'artists' && <ArtistDirectory items={directory} />}
      </div>

      <div
        ref={(el) => {
          panelRefs.current['top-lists'] = el
        }}
      >
        {tab === 'top-lists' && <TopListsTab />}
      </div>
    </>
  )
}
