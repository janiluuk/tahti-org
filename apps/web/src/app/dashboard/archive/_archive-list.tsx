// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import dynamic from 'next/dynamic'
import { ArchiveItemPlayback } from '@/components/archive-item-playback'
import type { PlayerTrack } from '@/contexts/player-context'
import { HearthisEmbedRow } from '../../u/[username]/c/[slug]/_hearthis-embed-row'
import { MixcloudEmbedRow } from '../../u/[username]/c/[slug]/_mixcloud-embed-row'
import { SpotifyEmbedRow } from '../../u/[username]/c/[slug]/_spotify-embed-row'
import { LibraryBrowser } from '@/components/library/library-browser'

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
  // Shared play queue, in display order — lets playback auto-advance to the
  // next track on 'ended' instead of just stopping, same as public listings.
  return (
    <LibraryBrowser
      items={items}
      getTitle={(item) => item.title}
      getCreatedAt={(item) => item.createdAt}
      getPinnedAt={(item) => item.pinnedAt}
      getStatus={itemFilter}
      searchPlaceholder="Search archive…"
      noMatchMessage="No recordings match."
    >
      {(visible) => {
        const queue: PlayerTrack[] = visible
          .map((item) => playable.find((p) => p.id === item.id))
          .filter((p): p is PlayableItem => Boolean(p?.audioUrl))
          .map((p) => ({
            id: p.id,
            kind: 'archive' as const,
            url: p.audioUrl!,
            title: p.title,
            subtitle: p.artistName?.trim() || `@${artistUsername}`,
            artworkUrl: p.bannerUrl,
          }))
        return (
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
                      // (Not using the full .brand-channel class here — it sets min-height:100vh
                      // for a page root, which would blow out this inline row's height.)
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
                    {!play?.audioUrl && play?.embedUri && (
                      <ul className="archive-list__embed">
                        {play.embedProvider === 'MIXCLOUD' ? (
                          <MixcloudEmbedRow title={play.title} embedUri={play.embedUri} />
                        ) : play.embedProvider === 'SPOTIFY' ? (
                          <SpotifyEmbedRow title={play.title} embedUri={play.embedUri} />
                        ) : (
                          <HearthisEmbedRow title={play.title} embedUri={play.embedUri} />
                        )}
                      </ul>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )
      }}
    </LibraryBrowser>
  )
}
