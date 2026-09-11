// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { TracklistEntry, ChannelGalleryMode, ReleaseCredit } from '@tahti/shared'
import { SOUND_METADATA_DEFAULTS } from '../../../lib/sound-metadata-options'
import { RELEASE_CREDIT_ROLES } from '@tahti/shared'
import type { SoundMetadataFormState } from './types'

function parseCredits(value: unknown): ReleaseCredit[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (row): row is ReleaseCredit =>
      Boolean(row) &&
      typeof row === 'object' &&
      typeof (row as ReleaseCredit).name === 'string' &&
      RELEASE_CREDIT_ROLES.includes((row as ReleaseCredit).role),
  )
}

export function defaultMetadataFormState(): SoundMetadataFormState {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16)
  return {
    description: '',
    artistName: '',
    credits: [],
    genre: 'Electronic',
    genreCustom: '',
    recordingLocation: '',
    venueId: null,
    subGenres: '',
    tags: '',
    contentType: SOUND_METADATA_DEFAULTS.contentType,
    mixVersion: '',
    bpm: '',
    musicalKey: '',
    useDetectedBpmKey: SOUND_METADATA_DEFAULTS.useDetectedBpmKey,
    isAiGenerated: SOUND_METADATA_DEFAULTS.isAiGenerated,
    releasedAt: local,
    license: SOUND_METADATA_DEFAULTS.license,
    repostToDownload: SOUND_METADATA_DEFAULTS.repostToDownload,
    followToDownload: SOUND_METADATA_DEFAULTS.followToDownload,
    bannerUrl: '',
    backgroundUrl: '',
    slideshowUrls: '',
    galleryMode: 'NONE',
    galleryAudioReactive: false,
    commentary: '',
    taggedNote: '',
    isPublic: SOUND_METADATA_DEFAULTS.isPublic,
    commentsEnabled: true,
    selectsOptIn: SOUND_METADATA_DEFAULTS.selectsOptIn,
    topListsEligible: true,
    tracklist: null,
  }
}

export function metadataFormToPayload(state: SoundMetadataFormState): Record<string, unknown> {
  const subGenres = state.subGenres
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 12)

  const tags = state.tags
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20)

  const credits = state.credits
    .map((c) => {
      const handle = c.artistUsername?.trim().replace(/^@/, '').toLowerCase()
      return {
        role: c.role,
        name: c.name.trim(),
        ...(handle && /^[a-z0-9_-]{2,32}$/.test(handle) ? { artistUsername: handle } : {}),
      }
    })
    .filter((c) => c.name.length > 0)

  return {
    description: state.description.trim() || undefined,
    artistName: state.artistName.trim() || null,
    credits: credits.length > 0 ? credits : null,
    genre: state.genre || undefined,
    genreCustom: state.genreCustom.trim() || undefined,
    recordingLocation: state.recordingLocation.trim() || undefined,
    venueId: state.venueId,
    subGenres: subGenres.length ? subGenres : undefined,
    tags: tags.length ? tags : undefined,
    contentType: state.contentType,
    mixVersion: state.mixVersion.trim() || undefined,
    bpm: state.bpm ? parseInt(state.bpm, 10) : undefined,
    musicalKey: state.musicalKey.trim() || undefined,
    useDetectedBpmKey: state.useDetectedBpmKey,
    isAiGenerated: state.isAiGenerated,
    releasedAt: state.releasedAt ? new Date(state.releasedAt).toISOString() : undefined,
    license: state.license,
    repostToDownload: state.repostToDownload,
    followToDownload: state.followToDownload,
    bannerUrl: state.bannerUrl.trim() || undefined,
    backgroundUrl: state.backgroundUrl.trim() || undefined,
    slideshowUrls: state.slideshowUrls
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 10),
    galleryMode: state.galleryMode,
    galleryAudioReactive: state.galleryAudioReactive,
    commentary: state.commentary.trim() || undefined,
    taggedNote: state.taggedNote.trim() || undefined,
    isPublic: state.isPublic,
    commentsEnabled: state.commentsEnabled,
    selectsOptIn: state.selectsOptIn,
    topListsEligible: state.topListsEligible,
    tracklist: state.tracklist,
  }
}

export function metadataFromApi(item: Record<string, unknown>): SoundMetadataFormState {
  const released = item.releasedAt as string | undefined
  const localReleased = released
    ? new Date(released).toISOString().slice(0, 16)
    : defaultMetadataFormState().releasedAt

  return {
    description: (item.description as string) ?? '',
    artistName: (item.artistName as string) ?? '',
    credits: parseCredits(item.credits),
    genre: (item.genre as string) ?? 'Electronic',
    genreCustom: (item.genreCustom as string) ?? '',
    recordingLocation: (item.recordingLocation as string) ?? '',
    venueId: (item.venueId as string | null) ?? null,
    subGenres: Array.isArray(item.subGenres) ? (item.subGenres as string[]).join(', ') : '',
    tags: Array.isArray(item.tags) ? (item.tags as string[]).join(', ') : '',
    contentType: (item.contentType as string) ?? SOUND_METADATA_DEFAULTS.contentType,
    mixVersion: (item.mixVersion as string) ?? '',
    bpm: item.bpm != null ? String(item.bpm) : '',
    musicalKey: (item.musicalKey as string) ?? '',
    useDetectedBpmKey: (item.useDetectedBpmKey as boolean) ?? true,
    isAiGenerated: (item.isAiGenerated as boolean) ?? false,
    releasedAt: localReleased,
    license: (item.license as string) ?? SOUND_METADATA_DEFAULTS.license,
    repostToDownload: (item.repostToDownload as boolean) ?? false,
    followToDownload: (item.followToDownload as boolean) ?? false,
    bannerUrl: (item.bannerUrl as string) ?? '',
    backgroundUrl: (item.backgroundUrl as string) ?? '',
    slideshowUrls: Array.isArray(item.slideshowUrls)
      ? (item.slideshowUrls as string[]).join('\n')
      : '',
    galleryMode: (item.galleryMode as ChannelGalleryMode) ?? 'NONE',
    galleryAudioReactive: (item.galleryAudioReactive as boolean) ?? false,
    commentary: (item.commentary as string) ?? '',
    taggedNote: (item.taggedNote as string) ?? '',
    isPublic: (item.isPublic as boolean) ?? true,
    commentsEnabled: (item.commentsEnabled as boolean) ?? true,
    selectsOptIn: (item.selectsOptIn as boolean) ?? false,
    topListsEligible: (item.topListsEligible as boolean) ?? true,
    tracklist: Array.isArray(item.tracklist) ? (item.tracklist as TracklistEntry[]) : null,
  }
}
