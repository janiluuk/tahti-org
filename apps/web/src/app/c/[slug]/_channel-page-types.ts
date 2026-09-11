// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type {
  ChannelGalleryMode,
  ChannelTextLayerAlignment,
  ChannelTextLayerMode,
  TracklistEntry,
} from '@tahti/shared'

export interface ChannelResponse {
  slug: string
  state: string
  hlsUrl: string | null
  /** Real Icecast ingest — false when only 24/7 archive fallback is playing */
  signalConnected?: boolean
  nextBroadcastAt: string | null
  nextBroadcastNote: string | null
  galleryMode: ChannelGalleryMode
  slideshowImages: string[]
  textLayerMode: ChannelTextLayerMode
  textLayerText: string
  textLayerAlign: ChannelTextLayerAlignment
  videoBackgroundUrl?: string | null
  headerStyle?: string
  brandAccentPreset?: string | null
  colorSchemeJson?: string | null
  visualPreset?: string
  visualSettingsJson?: string | null
  slideshowPreset?: string
  slideshowIntervalSeconds?: number
  slideshowTransitionMs?: number
  slideshowAutoplay?: boolean
  user: {
    username: string
    displayName: string
    bio: string | null
    avatarUrl: string | null
    countryCode?: string | null
    pronouns?: string | null
    socialLinks?: Record<string, string> | null
    tier: string
    isMember?: boolean
    joinDate?: string | null
    chatEnabled?: boolean
  }
  nowPlaying: {
    title: string
    artistName: string
    artistUsername: string | null
    artworkUrl: string | null
  } | null
  nowPlayingNext: { title: string; artistName: string; artistUsername: string } | null
}

export interface SoundItem {
  id: string
  title: string
  artistName?: string | null
  credits?: Array<{ role: string; name: string; artistUsername?: string }> | null
  description: string | null
  commentary: string | null
  durationSec: number | null
  audioUrl: string | null
  peaks?: number[] | null
  createdAt: string
  genre?: string | null
  genreCustom?: string | null
  tracklist?: TracklistEntry[] | null
  visualPreset?: string | null
  repostToDownload?: boolean
  followToDownload?: boolean
  bannerUrl?: string | null
  backgroundUrl?: string | null
  slideshowUrls?: string[]
  galleryMode?: ChannelGalleryMode
  galleryAudioReactive?: boolean
  commentCount?: number
  downloadCount?: number
  accentColor?: string | null
}

export interface Announcement {
  id: string
  body: string
  createdAt: string
}

export interface ChannelEvent {
  id: string
  title: string
  place: string
  location: string
  eventUrl: string | null
  startAt: string
}

export interface ChannelPost {
  id: string
  title: string | null
  body: string
  images: string[]
  publishAt: string
  createdAt: string
}

export interface ChannelEmbed {
  id: string
  url: string
  title: string | null
}
