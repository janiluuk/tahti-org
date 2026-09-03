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
import { SoundTrackRow } from './_sound-track-row'
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
      getTitle={(item) => item.sound?.title ?? item.release?.title ?? 'Untitled'}
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
            (i) => i.sound?.audioUrl || (i.sound?.source === 'HEARTHIS_EMBED' && i.sound.embedUri),
          )
          .map((i) => ({
            id: i.sound!.id,
            kind: 'sound',
            url: i.sound!.audioUrl ?? '',
            title: i.sound!.title,
            durationSec: i.sound!.durationSec,
            subtitle: `@${artistUsername}`,
            ...(i.sound!.source === 'HEARTHIS_EMBED' && i.sound!.embedUri
              ? {
                  embed: {
                    provider: 'HEARTHIS' as const,
                    embedUri: i.sound!.embedUri,
                  },
                }
              : {}),
          }))

        return (
          <>
            {queue.length > 0 && <PlaylistControls queue={queue} />}
            <ol className="prof-list prof-collection-items">
              {visible.map((item) => {
                if (item.sound?.source === 'SPOTIFY_EMBED' && item.sound.embedUri) {
                  return (
                    <SpotifyEmbedRow
                      key={item.id}
                      title={item.sound.title}
                      embedUri={item.sound.embedUri}
                    />
                  )
                }
                if (item.sound?.source === 'MIXCLOUD_EMBED' && item.sound.embedUri) {
                  return (
                    <MixcloudEmbedRow
                      key={item.id}
                      title={item.sound.title}
                      embedUri={item.sound.embedUri}
                    />
                  )
                }
                if (item.sound?.source === 'HEARTHIS_EMBED' && item.sound.embedUri) {
                  return (
                    <HearthisEmbedRow
                      key={item.id}
                      title={item.sound.title}
                      embedUri={item.sound.embedUri}
                      id={item.sound.id}
                      durationSec={item.sound.durationSec}
                      thumbUrl={item.sound.bannerUrl ?? item.release?.artworkUrl ?? null}
                      queue={queue}
                    />
                  )
                }
                const thumbUrl = item.sound?.bannerUrl ?? item.release?.artworkUrl ?? null
                if (item.sound?.audioUrl) {
                  return (
                    <SoundTrackRow
                      key={item.id}
                      id={item.sound.id}
                      title={item.sound.title}
                      audioUrl={item.sound.audioUrl}
                      artistUsername={artistUsername}
                      channelSlug={item.sound.channel?.slug ?? null}
                      thumbUrl={thumbUrl}
                      durationLabel={
                        item.sound.durationSec != null
                          ? formatDuration(item.sound.durationSec)
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
                      {item.sound && (
                        <>
                          <div className="prof-collection-title">{item.sound.title}</div>
                          {item.sound.durationSec != null && (
                            <span className="prof-list-meta">
                              {formatDuration(item.sound.durationSec)}
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
