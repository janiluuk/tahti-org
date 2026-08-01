// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import type { TahtiSelectsGalleryItem } from '@tahti/shared'
import { AvatarTile, RankBadge } from '@tahti/ui'
import { usePlayer, type PlayerTrack } from '@/contexts/player-context'
import { ChannelVisualizer } from '@/components/visuals/channel-visualizer'
import { resolveChannelUrl } from '@/lib/app-url'

function toTrack(item: TahtiSelectsGalleryItem): PlayerTrack {
  return {
    id: item.archiveItemId,
    kind: 'archive',
    url: item.audioUrl ?? '',
    title: item.title,
    subtitle: item.artistName,
    href: resolveChannelUrl(item.channelSlug),
    artworkUrl: item.bannerUrl,
  }
}

function GalleryTile({
  item,
  queue,
  rank,
}: {
  item: TahtiSelectsGalleryItem
  queue: TahtiSelectsGalleryItem[]
  rank?: number
}) {
  const { track, playing, analyser, load, togglePlay } = usePlayer()
  const isCurrent = track?.id === item.archiveItemId

  function handleClick() {
    if (!item.audioUrl) return
    if (isCurrent) {
      void togglePlay()
      return
    }
    load(toTrack(item), {
      autoplay: true,
      queue: queue.filter((g) => g.audioUrl).map(toTrack),
    })
  }

  return (
    <button
      type="button"
      className={`selects-gallery__tile${isCurrent ? ' selects-gallery__tile--current' : ''}${isCurrent && playing ? ' selects-gallery__tile--playing' : ''}`}
      onClick={handleClick}
      disabled={!item.audioUrl}
      aria-label={`Play ${item.title} by ${item.artistName}`}
    >
      {item.bannerUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.bannerUrl} alt="" className="selects-gallery__art" />
      ) : (
        <AvatarTile size="full" name={item.title} className="selects-gallery__art" />
      )}
      {isCurrent && (
        <ChannelVisualizer
          preset="PARTICLE_FIELD"
          analyser={playing ? analyser : null}
          className="selects-gallery__viz"
        />
      )}
      {rank && <RankBadge rank={rank} />}
      <span className="selects-gallery__playhint" aria-hidden>
        {isCurrent && playing ? (
          <svg width="22" height="22" viewBox="0 0 18 18" fill="currentColor">
            <rect x="3" y="2" width="4" height="14" rx="1" />
            <rect x="11" y="2" width="4" height="14" rx="1" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 18 18" fill="currentColor">
            <path d="M5 3l11 6-11 6V3z" />
          </svg>
        )}
      </span>
      <span className="selects-gallery__meta">
        <span className="selects-gallery__title">{item.title}</span>
        <span className="selects-gallery__artist">{item.artistName}</span>
      </span>
    </button>
  )
}

export function SelectsGallery({
  items,
  ranks = {},
}: {
  items: TahtiSelectsGalleryItem[]
  ranks?: Record<string, number>
}) {
  if (items.length === 0) {
    return (
      <div className="public-empty-card">
        <p className="public-empty-card__text">Nothing in the Tahti Selects rotation yet.</p>
        <p className="public-empty-card__hint">
          Artists can opt tracks in from their archive editor — check back soon.
        </p>
      </div>
    )
  }

  return (
    <ul className="selects-gallery">
      {items.map((item) => (
        <li key={item.archiveItemId}>
          <GalleryTile item={item} queue={items} rank={ranks[item.archiveItemId]} />
        </li>
      ))}
    </ul>
  )
}
