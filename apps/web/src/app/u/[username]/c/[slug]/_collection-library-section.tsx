// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import Link from 'next/link'
import type { PlayerTrack } from '@/contexts/player-context'
import { LibraryBrowser } from '@/components/library/library-browser'
import { CollectionCoverButton } from './_collection-gallery'
import { SpotifyEmbedRow } from './_spotify-embed-row'
import { MixcloudEmbedRow } from './_mixcloud-embed-row'
import { HearthisEmbedRow } from './_hearthis-embed-row'
import { ArchiveTrackRow } from './_archive-track-row'
import { PlaylistControls } from './_playlist-controls'
import type { CollectionResponse } from './page'

function formatDuration(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}

/**
 * LibraryBrowser's getTitle/children props are functions — illegal to pass
 * across the Server → Client boundary (RSC serialization). The parent
 * page.tsx is a Server Component, so this closure-owning wrapper is
 * required; it only receives plain serializable data as props.
 */
export function CollectionLibrarySection({
  items,
  artistUsername,
}: {
  items: CollectionResponse['items']
  artistUsername: string
}) {
  return (
    <LibraryBrowser
      items={items}
      getTitle={(item) => item.archiveItem?.title ?? item.release?.title ?? 'Untitled'}
      searchPlaceholder="Search playlist…"
      emptyMessage="This collection is empty."
      noMatchMessage="No playlist items match."
      showStatusFilters={false}
    >
      {(visible) => {
        // Include HearThis embeds so they follow the same shared queue
        // as Tahti-hosted tracks, in the currently displayed order.
        const queue: PlayerTrack[] = visible
          .filter(
            (i) =>
              i.archiveItem?.audioUrl ||
              (i.archiveItem?.source === 'HEARTHIS_EMBED' && i.archiveItem.embedUri),
          )
          .map((i) => ({
            id: i.archiveItem!.id,
            kind: 'archive',
            url: i.archiveItem!.audioUrl ?? '',
            title: i.archiveItem!.title,
            durationSec: i.archiveItem!.durationSec,
            subtitle: `@${artistUsername}`,
            ...(i.archiveItem!.source === 'HEARTHIS_EMBED' && i.archiveItem!.embedUri
              ? {
                  embed: {
                    provider: 'HEARTHIS' as const,
                    embedUri: i.archiveItem!.embedUri,
                  },
                }
              : {}),
          }))

        return (
          <>
            {queue.length > 0 && <PlaylistControls queue={queue} />}
            <ol className="prof-list prof-collection-items">
              {visible.map((item) => {
                if (item.archiveItem?.source === 'SPOTIFY_EMBED' && item.archiveItem.embedUri) {
                  return (
                    <SpotifyEmbedRow
                      key={item.id}
                      title={item.archiveItem.title}
                      embedUri={item.archiveItem.embedUri}
                    />
                  )
                }
                if (item.archiveItem?.source === 'MIXCLOUD_EMBED' && item.archiveItem.embedUri) {
                  return (
                    <MixcloudEmbedRow
                      key={item.id}
                      title={item.archiveItem.title}
                      embedUri={item.archiveItem.embedUri}
                    />
                  )
                }
                if (item.archiveItem?.source === 'HEARTHIS_EMBED' && item.archiveItem.embedUri) {
                  return (
                    <HearthisEmbedRow
                      key={item.id}
                      title={item.archiveItem.title}
                      embedUri={item.archiveItem.embedUri}
                      id={item.archiveItem.id}
                      durationSec={item.archiveItem.durationSec}
                      thumbUrl={item.archiveItem.bannerUrl ?? item.release?.artworkUrl ?? null}
                      queue={queue}
                    />
                  )
                }
                const thumbUrl = item.archiveItem?.bannerUrl ?? item.release?.artworkUrl ?? null
                if (item.archiveItem?.audioUrl) {
                  return (
                    <ArchiveTrackRow
                      key={item.id}
                      id={item.archiveItem.id}
                      title={item.archiveItem.title}
                      audioUrl={item.archiveItem.audioUrl}
                      artistUsername={artistUsername}
                      channelSlug={item.archiveItem.channel?.slug ?? null}
                      thumbUrl={thumbUrl}
                      durationLabel={
                        item.archiveItem.durationSec != null
                          ? formatDuration(item.archiveItem.durationSec)
                          : null
                      }
                      addedByDisplayName={
                        item.addedBy && item.addedBy.username !== artistUsername
                          ? item.addedBy.displayName
                          : null
                      }
                      addNote={item.addNote}
                      queue={queue}
                    />
                  )
                }
                return (
                  <li key={item.id} className="prof-collection-item-row">
                    <CollectionCoverButton
                      url={thumbUrl}
                      className="prof-collection-cover prof-collection-cover--item"
                      imgWidth={40}
                      imgHeight={40}
                    />
                    <div className="prof-collection-item-body">
                      {item.archiveItem && (
                        <>
                          <div className="prof-collection-title">{item.archiveItem.title}</div>
                          {item.archiveItem.durationSec != null && (
                            <span className="prof-list-meta">
                              {formatDuration(item.archiveItem.durationSec)}
                            </span>
                          )}
                        </>
                      )}
                      {item.release && (
                        <>
                          <Link href={`/r/${item.release.smartLinkSlug}`}>
                            {item.release.title}
                          </Link>
                          <span className="prof-list-meta">
                            {' '}
                            · {item.release.type} ·{' '}
                            {new Date(item.release.releaseDate).toLocaleDateString()}
                          </span>
                        </>
                      )}
                    </div>
                  </li>
                )
              })}
            </ol>
          </>
        )
      }}
    </LibraryBrowser>
  )
}
