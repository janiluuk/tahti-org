// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const ARCHIVE_CONTENT_TYPES = [
  'STUDIO',
  'LIVE',
  'DJ_MIX',
  'PODCAST',
  'ORIGINAL',
  'REMIX',
  'RADIO_SHOW',
] as const

export const ARCHIVE_LICENSES = [
  'ALL_RIGHTS_RESERVED',
  'CC_BY',
  'CC_BY_NC',
  'CC_BY_NC_SA',
  'CC_BY_NC_ND',
  'CC_BY_SA',
  'CC0',
] as const

/** Preset genres (hearthis-style); artists can pick custom via genreCustom. */
export const ARCHIVE_GENRES = [
  'Electronic',
  'House',
  'Techno',
  'Trance',
  'Drum & Bass',
  'Dubstep',
  'Ambient',
  'Hip-Hop',
  'Pop',
  'Rock',
  'Jazz',
  'Classical',
  'Podcast',
  'Other',
] as const

export const ARCHIVE_LICENSE_LABELS: Record<(typeof ARCHIVE_LICENSES)[number], string> = {
  ALL_RIGHTS_RESERVED: 'All rights reserved',
  CC_BY: 'Creative Commons — Attribution (CC BY)',
  CC_BY_NC: 'CC BY-NC',
  CC_BY_NC_SA: 'CC BY-NC-SA',
  CC_BY_NC_ND: 'CC BY-NC-ND',
  CC_BY_SA: 'CC BY-SA',
  CC0: 'CC0 — Public domain',
}

export const TracklistEntrySchema = z.object({
  startSec: z.number().min(0),
  title: z.string().min(1).max(200),
  artist: z.string().max(120).optional(),
})

export const ArchiveMetadataFieldsSchema = z.object({
  description: z.string().max(2000).optional(),
  tracklist: z.array(TracklistEntrySchema).max(200).nullable().optional(),
  bannerUrl: z.string().max(2048).nullable().optional(),
  backgroundUrl: z.string().max(2048).nullable().optional(),
  slideshowUrls: z.array(z.string().max(2048)).max(10).optional(),
  commentary: z.string().max(5000).nullable().optional(),
  taggedNote: z.string().max(500).nullable().optional(),
  genre: z.string().max(80).nullable().optional(),
  genreCustom: z.string().max(80).nullable().optional(),
  recordingLocation: z.string().max(120).nullable().optional(),
  subGenres: z.array(z.string().max(40).trim()).max(12).optional(),
  contentType: z.enum(ARCHIVE_CONTENT_TYPES).optional(),
  mixVersion: z.string().max(120).nullable().optional(),
  bpm: z.number().int().min(40).max(300).nullable().optional(),
  musicalKey: z.string().max(12).nullable().optional(),
  useDetectedBpmKey: z.boolean().optional(),
  isAiGenerated: z.boolean().optional(),
  releasedAt: z.string().datetime().optional(),
  license: z.enum(ARCHIVE_LICENSES).optional(),
  repostToDownload: z.boolean().optional(),
  followToDownload: z.boolean().optional(),
  isPublic: z.boolean().optional(),
  isFallback: z.boolean().optional(),
})

export type ArchiveMetadataFields = z.infer<typeof ArchiveMetadataFieldsSchema>

export const ArchiveMetadataPatchSchema = ArchiveMetadataFieldsSchema.extend({
  title: z.string().min(1).max(200).trim().optional(),
}).partial()

export type ArchiveMetadataPatch = z.infer<typeof ArchiveMetadataPatchSchema>

export const ArchiveUploadMetadataSchema = ArchiveMetadataFieldsSchema.partial()

export type ArchiveUploadMetadata = z.infer<typeof ArchiveUploadMetadataSchema>

/** Sensible defaults for dashboard uploads (hearthis-style). */
export const ARCHIVE_METADATA_DEFAULTS = {
  genre: 'Electronic',
  contentType: 'STUDIO' as const,
  license: 'ALL_RIGHTS_RESERVED' as const,
  useDetectedBpmKey: true,
  isAiGenerated: false,
  repostToDownload: false,
  followToDownload: false,
  isPublic: true,
  isFallback: false,
  subGenres: [] as string[],
  slideshowUrls: [] as string[],
}
