// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { SoundSource, SoundQualityBadge } from '@tahti/shared'
import type { PlayerTrack } from '@/contexts/player-context'
import { mixcloudCoverProxySrc } from './_mixcloud-import-modal'
import { spotifyCoverProxySrc } from './_spotify-import-modal'

export interface CollectionItem {
  id: string
  position: number
  audioUrl?: string | null
  sound: {
    id: string
    title: string
    durationSec: number | null
    bannerUrl: string | null
    createdAt: string
    source: SoundSource
    qualityBadge: SoundQualityBadge
    embedProvider?: string | null
    embedUri?: string | null
  } | null
  release: {
    id: string
    title: string
    type: string
    smartLinkSlug: string
    artworkUrl: string | null
    releaseDate?: string | null
  } | null
}

export function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export function itemTitle(item: CollectionItem): string {
  return item.sound?.title ?? item.release?.title ?? '—'
}

export function itemThumb(item: CollectionItem): string | null {
  const bannerUrl = item.sound?.bannerUrl ?? null
  if (bannerUrl && item.sound?.source === 'SPOTIFY_EMBED') {
    return spotifyCoverProxySrc(bannerUrl)
  }
  if (bannerUrl && item.sound?.source === 'MIXCLOUD_EMBED') {
    return mixcloudCoverProxySrc(bannerUrl)
  }
  return bannerUrl ?? item.release?.artworkUrl ?? null
}

export function toPlayerTrack(item: CollectionItem): PlayerTrack {
  const isHearthis = item.sound?.source === 'HEARTHIS_EMBED' && item.sound.embedUri
  return {
    id: item.sound?.id ?? `collection-release-${item.release?.id ?? item.id}`,
    kind: 'sound',
    url: item.audioUrl ?? '',
    title: itemTitle(item),
    artworkUrl: itemThumb(item),
    durationSec: item.sound?.durationSec,
    ...(isHearthis
      ? { embed: { provider: 'HEARTHIS' as const, embedUri: item.sound!.embedUri! } }
      : {}),
  }
}
