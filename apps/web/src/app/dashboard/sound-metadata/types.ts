// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { TracklistEntry, ChannelGalleryMode, ReleaseCredit } from '@tahti/shared'

export type SoundMetadataFormState = {
  description: string
  artistName: string
  credits: ReleaseCredit[]
  genre: string
  genreCustom: string
  recordingLocation: string
  venueId: string | null
  subGenres: string
  tags: string
  contentType: string
  mixVersion: string
  bpm: string
  musicalKey: string
  useDetectedBpmKey: boolean
  isAiGenerated: boolean
  releasedAt: string
  license: string
  repostToDownload: boolean
  followToDownload: boolean
  bannerUrl: string
  backgroundUrl: string
  slideshowUrls: string
  galleryMode: ChannelGalleryMode
  galleryAudioReactive: boolean
  commentary: string
  taggedNote: string
  isPublic: boolean
  commentsEnabled: boolean
  selectsOptIn: boolean
  topListsEligible: boolean
  tracklist: TracklistEntry[] | null
}

export type SectionProps = {
  state: SoundMetadataFormState
  onChange: (next: SoundMetadataFormState) => void
  disabled?: boolean
}

export const EMPTY_CREDIT: ReleaseCredit = { role: 'performer', name: '' }
