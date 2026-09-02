// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { resolveColorScheme } from '@tahti/shared'
import { randomCoverGradient, StudioSwitch } from '@tahti/ui'
import type { PlayerTrack } from '@/contexts/player-context'
import { LibraryBrowser } from '@/components/library/library-browser'

const ArchiveEditor = dynamic(() => import('../archive-editor'))

type ArchiveListItem = Record<string, unknown> & {
  id: string
  title: string
  status: string
  isPublic?: boolean
  pinnedAt?: string | null
  createdAt?: string
  embedUri?: string | null
  embedProvider?: string | null
  colorSchemeJson?: string | null
  paletteJson?: string | null
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

function itemFilter(item: ArchiveListItem): 'unpublished' | 'drafts' | 'published' {
  if (item.status !== 'READY') return 'drafts'
  return item.isPublic === false ? 'unpublished' : 'published'
}

const EMBED_PROVIDER_LABELS: Record<string, string> = {
  HEARTHIS: 'hearthis.at',
  SPOTIFY: 'Spotify',
  MIXCLOUD: 'Mixcloud',
}

export function ArchiveList({
  items,
  playable,
  mixcloudConnected,
  mixcloudConfigured,
  apiUrl,
  channelSlug,
  artistUsername,
  showEmbedFilter,
}: {
  items: ArchiveListItem[]
  playable: PlayableItem[]
  mixcloudConnected: boolean
  mixcloudConfigured: boolean
  apiUrl: string
  channelSlug: string | null
  artistUsername: string
  /** Only meaningful on the plain Tracks list — DJ Sets/Embeds don't need a
   * way to hide embeds since they're either not embeds or nothing but. */
  showEmbedFilter?: boolean
}) {
  const [showEmbeds, setShowEmbeds] = useState(true)
  const baseItems = useMemo(
    () => (showEmbeds ? items : items.filter((item) => !item.embedUri)),
    [items, showEmbeds],
  )
  const embedCount = useMemo(() => items.filter((item) => item.embedUri).length, [items])
  // Assigned once per item (not per render) so a row's placeholder cover doesn't
  // change every time something else on the page re-renders it.
  const placeholderGradients = useMemo(
    () => new Map(items.map((item) => [item.id, randomCoverGradient()])),
    [items],
  )

  // Shared play queue, in display order — lets playback auto-advance to the
  // next track on 'ended' instead of just stopping, same as public listings.
  return (
    <LibraryBrowser
      items={baseItems}
      getTitle={(item) => item.title}
      getCreatedAt={(item) => item.createdAt}
      getPinnedAt={(item) => item.pinnedAt}
      getStatus={itemFilter}
      searchPlaceholder="Search archive…"
      noMatchMessage="No recordings match."
      toolbarExtra={
        showEmbedFilter && embedCount > 0 ? (
          <label className="archive-list__embed-filter">
            <StudioSwitch checked={showEmbeds} onChange={setShowEmbeds} label="Show embeds" />
            Show embeds
          </label>
        ) : undefined
      }
    >
      {(visible) => {
        const queue: PlayerTrack[] = visible
          .map((item) => playable.find((p) => p.id === item.id))
          .filter(
            (p): p is PlayableItem =>
              Boolean(p?.audioUrl) || (p?.embedProvider === 'HEARTHIS' && Boolean(p.embedUri)),
          )
          .map((p) => ({
            id: p.id,
            kind: 'archive' as const,
            url: p.audioUrl!,
            title: p.title,
            subtitle: p.artistName?.trim() || `@${artistUsername}`,
            artworkUrl: p.bannerUrl,
            ...(p.embedProvider === 'HEARTHIS' && p.embedUri
              ? { embed: { provider: 'HEARTHIS' as const, embedUri: p.embedUri } }
              : {}),
          }))
        return (
          <>
            <ul className="studio-list studio-mt-sm">
              {visible.map((item) => {
                const play = playable.find((a) => a.id === item.id)
                const cover = play?.bannerUrl
                const scheme = resolveColorScheme(item.colorSchemeJson, item.paletteJson)
                const providerLabel = play?.embedProvider
                  ? (EMBED_PROVIDER_LABELS[play.embedProvider] ?? play.embedProvider)
                  : null
                return (
                  <li
                    key={item.id}
                    className="archive-list__row"
                    style={{
                      background: `linear-gradient(135deg, ${scheme.bg} 0%, ${scheme.accent}33 100%)`,
                    }}
                  >
                    <div className="archive-list__cover">
                      {cover ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={cover} alt="" />
                      ) : (
                        <div
                          className={`archive-list__cover-ph cover-gradient--${placeholderGradients.get(item.id) ?? 'aurora'}`}
                          aria-hidden
                        />
                      )}
                      {providerLabel && (
                        <span className="archive-list__cover-embed-badge">{providerLabel}</span>
                      )}
                    </div>
                    <div className="archive-list__row-body">
                      <ArchiveEditor
                        item={item}
                        mixcloudConnected={mixcloudConnected}
                        mixcloudConfigured={mixcloudConfigured}
                        apiUrl={apiUrl}
                        channelSlug={channelSlug}
                        artistUsername={artistUsername}
                        play={play}
                        queue={queue}
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
          </>
        )
      }}
    </LibraryBrowser>
  )
}
