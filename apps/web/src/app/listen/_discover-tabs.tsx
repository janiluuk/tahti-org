// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import type { ChannelCard, ChannelDirectoryEntry, TahtiSelectsGalleryItem } from '@tahti/shared'
import { ListenChannels } from './_listen-channels'
import { ArtistDirectory } from './_artist-directory'
import { SelectsGallery } from './_selects-gallery'

type Tab = 'live' | 'selects' | 'artists'

export function DiscoverTabs({
  live,
  recent,
  listenerCounts,
  directory,
  gallery,
}: {
  live: ChannelCard[]
  recent: ChannelCard[]
  listenerCounts: Record<string, number>
  directory: ChannelDirectoryEntry[]
  gallery: TahtiSelectsGalleryItem[]
}) {
  const [tab, setTab] = useState<Tab>('live')
  const empty = live.length === 0 && recent.length === 0

  return (
    <>
      <div className="discover-tabs" role="tablist" aria-label="Discover view">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'live'}
          className={`discover-tab${tab === 'live' ? ' discover-tab--active' : ''}`}
          onClick={() => setTab('live')}
        >
          Live &amp; recent
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'selects'}
          className={`discover-tab${tab === 'selects' ? ' discover-tab--active' : ''}`}
          onClick={() => setTab('selects')}
        >
          Tahti Selects
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'artists'}
          className={`discover-tab${tab === 'artists' ? ' discover-tab--active' : ''}`}
          onClick={() => setTab('artists')}
        >
          Artists &amp; genres
        </button>
      </div>

      {tab === 'live' &&
        (empty ? (
          <div className="public-empty-card">
            <p className="public-empty-card__text">No channels live right now.</p>
            <p className="public-empty-card__hint">
              Check the Tahti Selects or Artists tab, or check back later.
            </p>
          </div>
        ) : (
          <ListenChannels live={live} recent={recent} listenerCounts={listenerCounts} />
        ))}

      {tab === 'selects' && <SelectsGallery items={gallery} />}

      {tab === 'artists' && <ArtistDirectory items={directory} />}
    </>
  )
}
