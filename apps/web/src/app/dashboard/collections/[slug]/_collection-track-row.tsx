// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import type { SoundSource, SoundQualityBadge } from '@tahti/shared'
import { QUALITY_BADGE_LABEL } from '@tahti/shared'
import type { PlayerTrack } from '@/contexts/player-context'
import { MixcloudEmbedRow } from '../../../u/[username]/c/[slug]/_mixcloud-embed-row'
import { SpotifyEmbedRow } from '../../../u/[username]/c/[slug]/_spotify-embed-row'
import {
  type CollectionItem,
  formatDuration,
  itemTitle,
  itemThumb,
  toPlayerTrack,
} from './_collection-editor-utils'

const SOURCE_BADGE_LABEL: Partial<Record<SoundSource, string>> = {
  SPOTIFY_EMBED: 'SPOTIFY EMBED',
  MIXCLOUD_EMBED: 'MIXCLOUD EMBED',
  HEARTHIS_EMBED: 'HEARTHIS EMBED',
  URL_EMBED: 'EMBED',
}

const SOURCE_BADGE_CLASS: Partial<Record<SoundSource, string>> = {
  SPOTIFY_EMBED: 'collection-tracklist__badge--spotify',
  MIXCLOUD_EMBED: 'collection-tracklist__badge--mixcloud',
  HEARTHIS_EMBED: 'collection-tracklist__badge--hearthis',
  URL_EMBED: 'collection-tracklist__badge--embed',
}

const QUALITY_BADGE_CLASS: Record<SoundQualityBadge, string> = {
  LOSSLESS: '',
  TRANSCODED: 'collection-tracklist__badge--transcoded',
  EMBED_ONLY: 'collection-tracklist__badge--embed',
}

export function CollectionTrackRowBody({
  item,
  idx,
  playing,
  reorderSaving,
  track,
  expandedEmbedItemId,
  onToggleEmbedExpanded,
  onQueueItem,
  onToggleItemPlayback,
}: {
  item: CollectionItem
  idx: number
  playing: boolean
  reorderSaving: boolean
  track: PlayerTrack | null
  expandedEmbedItemId: string | null
  onToggleEmbedExpanded: (itemId: string | null) => void
  onQueueItem: (item: CollectionItem) => void
  onToggleItemPlayback: (item: CollectionItem) => void
}) {
  const thumb = itemThumb(item)
  const title = itemTitle(item)
  const dur = item.sound?.durationSec
  const source = item.sound?.source
  const quality = item.sound?.qualityBadge
  const badgeLabel =
    (source ? SOURCE_BADGE_LABEL[source] : undefined) ??
    (quality ? QUALITY_BADGE_LABEL[quality] : undefined)
  const badgeClass =
    (source ? SOURCE_BADGE_CLASS[source] : undefined) ??
    (quality ? QUALITY_BADGE_CLASS[quality] : undefined)
  const embedUri = item.sound?.embedUri
  const embedProvider = item.sound?.embedProvider
  const isEmbedExpanded = expandedEmbedItemId === item.id
  const playerTrack = toPlayerTrack(item)

  return (
    <>
      <span className="collection-tracklist__pos">{idx + 1}</span>
      {thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumb} alt="" className="collection-tracklist__thumb" />
      ) : (
        <div className="collection-tracklist__thumb collection-tracklist__thumb--ph" />
      )}
      <span className="collection-tracklist__title">{title}</span>
      {item.audioUrl ? (
        <span className="collection-tracklist__playback">
          <button
            type="button"
            onClick={() => void onToggleItemPlayback(item)}
            title={track?.id === playerTrack.id && playing ? 'Pause' : 'Play'}
            aria-label={
              track?.id === playerTrack.id && playing ? `Pause ${title}` : `Play ${title}`
            }
          >
            {track?.id === playerTrack.id && playing ? '❚❚' : '▶'}
          </button>
          <button
            type="button"
            onClick={() => onQueueItem(item)}
            title="Add to queue"
            aria-label={`Add ${title} to queue`}
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path
                d="M2.5 4h11M2.5 8h11M2.5 12h7"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
              <path
                d="M12 10.5v4M10 12.5h4"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </span>
      ) : embedUri ? (
        <span className="collection-tracklist__playback">
          <button
            type="button"
            onClick={() =>
              embedProvider === 'HEARTHIS'
                ? void onToggleItemPlayback(item)
                : onToggleEmbedExpanded(isEmbedExpanded ? null : item.id)
            }
            title={embedProvider === 'HEARTHIS' ? 'Play' : isEmbedExpanded ? 'Hide player' : 'Play'}
            aria-label={
              embedProvider === 'HEARTHIS'
                ? `Play ${title}`
                : isEmbedExpanded
                  ? `Hide ${title} player`
                  : `Play ${title}`
            }
            aria-expanded={embedProvider === 'HEARTHIS' ? undefined : isEmbedExpanded}
          >
            {embedProvider === 'HEARTHIS' && track?.id === playerTrack.id && playing
              ? '❚❚'
              : isEmbedExpanded
                ? '❚❚'
                : '▶'}
          </button>
          {embedProvider === 'HEARTHIS' && (
            <button
              type="button"
              onClick={() => onQueueItem(item)}
              title="Add to queue"
              aria-label={`Add ${title} to queue`}
            >
              +
            </button>
          )}
        </span>
      ) : null}
      {badgeLabel ? (
        <span className={`collection-tracklist__badge ${badgeClass ?? ''}`}>{badgeLabel}</span>
      ) : null}
      {dur != null && <span className="collection-tracklist__dur">{formatDuration(dur)}</span>}
      {isEmbedExpanded && embedUri && embedProvider !== 'HEARTHIS' && (
        <ul className="collection-tracklist__embed">
          {embedProvider === 'MIXCLOUD' ? (
            <MixcloudEmbedRow title={title} embedUri={embedUri} />
          ) : embedProvider === 'SPOTIFY' ? (
            <SpotifyEmbedRow title={title} embedUri={embedUri} />
          ) : null}
        </ul>
      )}
      {reorderSaving && (
        <span className="collection-tracklist__saving" aria-hidden>
          …
        </span>
      )}
    </>
  )
}
