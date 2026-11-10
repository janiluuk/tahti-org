// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'
import { CHANNEL_GALLERY_MODES } from './channel-gallery.js'
import { ReleaseCreditSchema } from './release-ops.js'

export const SOUND_CONTENT_TYPES = [
  'TRACK',
  'LIVE',
  'DJ_SET',
  'PODCAST',
  'REMIX',
  'SHOW',
  'EPISODE',
  'CLIP',
  'EMBED',
] as const

/** What kind of file a Sound row holds — see SoundMediaKind in schema.prisma. */
export const SOUND_MEDIA_KINDS = ['AUDIO', 'IMAGE', 'VIDEO'] as const

export const SOUND_LICENSES = [
  'ALL_RIGHTS_RESERVED',
  'CC_BY',
  'CC_BY_NC',
  'CC_BY_NC_SA',
  'CC_BY_NC_ND',
  'CC_BY_SA',
  'CC0',
] as const

/** Preset genres (hearthis-style); artists can pick custom via genreCustom. */
export const SOUND_GENRES = [
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

/** A channel's genre tags live as a comma-joined string inside the User.socialLinks JSON bag. */
export function parseSocialLinksGenres(socialLinks: unknown): string[] {
  if (!socialLinks || typeof socialLinks !== 'object') return []
  const raw = (socialLinks as Record<string, unknown>).genres
  if (typeof raw !== 'string' || !raw.trim()) return []
  return raw
    .split(',')
    .map((g) => g.trim())
    .filter(Boolean)
}

/** Same shape as parseSocialLinksGenres, for the artist's self-selected roles
 * (dj/producer/band/etc — see ARTIST_ROLE_OPTIONS in tahti-web's
 * SettingsPanels.tsx), also comma-joined inside the same JSON bag. */
export function parseSocialLinksArtistRoles(socialLinks: unknown): string[] {
  if (!socialLinks || typeof socialLinks !== 'object') return []
  const raw = (socialLinks as Record<string, unknown>).artistRoles
  if (typeof raw !== 'string' || !raw.trim()) return []
  return raw
    .split(',')
    .map((r) => r.trim())
    .filter(Boolean)
}

export const SOUND_LICENSE_LABELS: Record<(typeof SOUND_LICENSES)[number], string> = {
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
  /** Plain-text artist credit (ACRCloud, external guests). */
  artist: z.string().max(120).optional(),
  /** Tahti @handle when the played artist is a member (M22 + M15). */
  artistUsername: z
    .string()
    .regex(/^[a-z0-9_-]{2,32}$/i)
    .optional(),
})

export type TracklistEntry = z.infer<typeof TracklistEntrySchema>

export const SoundMetadataFieldsSchema = z.object({
  description: z.string().max(2000).optional(),
  /** Display credit override — leave empty to use the channel / band artist name. */
  artistName: z.string().trim().max(120).nullable().optional(),
  /** Role-based credits when this track differs from the channel Members/Credits roster. */
  credits: z.array(ReleaseCreditSchema).max(20).nullable().optional(),
  tracklist: z.array(TracklistEntrySchema).max(200).nullable().optional(),
  bannerUrl: z.string().max(2048).nullable().optional(),
  backgroundUrl: z.string().max(2048).nullable().optional(),
  slideshowUrls: z.array(z.string().max(2048)).max(10).optional(),
  /** WebGL/static transition preset used to switch between slideshowUrls images. */
  galleryMode: z.enum(CHANNEL_GALLERY_MODES).optional(),
  /** When true, the gallery preset reacts to this track's own playback audio. */
  galleryAudioReactive: z.boolean().optional(),
  commentary: z.string().max(5000).nullable().optional(),
  taggedNote: z.string().max(500).nullable().optional(),
  genre: z.string().max(80).nullable().optional(),
  genreCustom: z.string().max(80).nullable().optional(),
  recordingLocation: z.string().max(120).nullable().optional(),
  venueId: z.string().max(64).nullable().optional(),
  subGenres: z.array(z.string().max(40).trim()).max(12).optional(),
  /** Free-form artist labels — no preset list, unlike genre/subGenres. */
  tags: z.array(z.string().max(40).trim()).max(20).optional(),
  contentType: z.enum(SOUND_CONTENT_TYPES).optional(),
  mediaKind: z.enum(SOUND_MEDIA_KINDS).optional(),
  mixVersion: z.string().max(120).nullable().optional(),
  bpm: z.number().int().min(40).max(300).nullable().optional(),
  musicalKey: z.string().max(12).nullable().optional(),
  useDetectedBpmKey: z.boolean().optional(),
  isAiGenerated: z.boolean().optional(),
  releasedAt: z.string().datetime().optional(),
  license: z.enum(SOUND_LICENSES).optional(),
  repostToDownload: z.boolean().optional(),
  followToDownload: z.boolean().optional(),
  /** Off hides the track from every public download route; streaming is unaffected. */
  downloadsEnabled: z.boolean().optional(),
  isPublic: z.boolean().optional(),
  isFallback: z.boolean().optional(),
  commentsEnabled: z.boolean().optional(),
  selectsOptIn: z.boolean().optional(),
  topListsEligible: z.boolean().optional(),
  /** Public "Stage" showcase (PLAT-Stage): pin/unpin this track at the top of the
   * artist's profile Stage tab. Server converts to/from Sound.pinnedAt. */
  pinned: z.boolean().optional(),
})

export type SoundMetadataFields = z.infer<typeof SoundMetadataFieldsSchema>

export const SoundMetadataPatchSchema = SoundMetadataFieldsSchema.extend({
  title: z.string().min(1).max(200).trim().optional(),
}).partial()

export type SoundMetadataPatch = z.infer<typeof SoundMetadataPatchSchema>

export const SoundUploadMetadataSchema = SoundMetadataFieldsSchema.partial()

export type SoundUploadMetadata = z.infer<typeof SoundUploadMetadataSchema>

/** Sensible defaults for dashboard uploads (hearthis-style). */
export const SOUND_METADATA_DEFAULTS = {
  genre: 'Electronic',
  contentType: 'TRACK' as const,
  mediaKind: 'AUDIO' as const,
  license: 'ALL_RIGHTS_RESERVED' as const,
  useDetectedBpmKey: true,
  isAiGenerated: false,
  repostToDownload: false,
  followToDownload: false,
  isPublic: true,
  isFallback: false,
  selectsOptIn: false,
  subGenres: [] as string[],
  tags: [] as string[],
  slideshowUrls: [] as string[],
}

/** Sort options for GET /api/me/sound (defaults to `newest`). */
export const SOUND_LIST_SORTS = ['newest', 'oldest', 'title', 'duration', 'bpm', 'genre'] as const

/** Embed / native source filter for the artist's own sound list.
 * Values match `SoundEmbedProvider` plus the synthetic `native` (no embed). */
export const SOUND_LIST_SOURCES = [
  'native',
  'HEARTHIS',
  'MIXCLOUD',
  'SPOTIFY',
  'YOUTUBE',
  'APPLE',
  'GENERIC',
  'MIKSERI',
] as const

export const SOUND_LIST_STATUSES = ['PENDING', 'PROCESSING', 'READY', 'ERROR'] as const

/** Page size ceiling for GET /api/me/sound when `limit` is set. */
export const SOUND_LIST_MAX_LIMIT = 100

/** Default page size when the client asks for a paged list without `limit`. */
export const SOUND_LIST_DEFAULT_LIMIT = 50

/** Ceiling on GET /api/me/sound/ids (select-all). */
export const SOUND_LIST_MAX_IDS = 50_000

/** Ceiling on the `ids` form of POST /api/me/sound/bulk-delete. */
export const SOUND_BULK_MAX_IDS = 5_000

/** How many per-id failures one bulk-delete / bulk-patch response carries. */
export const SOUND_BULK_MAX_ERRORS = 50

const BoolQuery = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
  .transform((v) => v === true || v === 'true' || v === '1')

const DateQuery = z
  .string()
  .trim()
  .refine(
    (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) || !Number.isNaN(Date.parse(v)),
    'expected YYYY-MM-DD or an ISO datetime',
  )

/** Comma-separated tag list for AND filtering (`tags=a,b` → has every tag). */
const TagsQuery = z
  .string()
  .trim()
  .transform((raw) =>
    raw
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .slice(0, 20),
  )
  .pipe(z.array(z.string().max(40)).max(20))

/** Shared filter fields for list / ids / facets / stats / bulk-by-filter. */
export const SoundListFilterSchema = z.object({
  q: z.string().trim().max(200).optional(),
  contentType: z.enum(SOUND_CONTENT_TYPES).optional(),
  source: z.enum(SOUND_LIST_SOURCES).optional(),
  status: z.enum(SOUND_LIST_STATUSES).optional(),
  uploadedFrom: DateQuery.optional(),
  uploadedTo: DateQuery.optional(),
  genre: z.string().trim().max(80).optional(),
  tag: z.string().trim().max(40).optional(),
  /** AND of tags (keep single `tag` for one-value filters / facets omit). */
  tags: TagsQuery.optional(),
  bpmMin: z.coerce.number().int().min(40).max(300).optional(),
  bpmMax: z.coerce.number().int().min(40).max(300).optional(),
  key: z.string().trim().max(12).optional(),
  isPublic: BoolQuery.optional(),
  isFallback: BoolQuery.optional(),
  pinned: BoolQuery.optional(),
})

export type SoundListFilter = z.infer<typeof SoundListFilterSchema>

export const SoundListQuerySchema = SoundListFilterSchema.extend({
  sort: z.enum(SOUND_LIST_SORTS).optional(),
  limit: z.coerce.number().int().min(1).max(SOUND_LIST_MAX_LIMIT).optional(),
  offset: z.coerce.number().int().min(0).max(1_000_000).optional(),
})

export type SoundListQuery = z.infer<typeof SoundListQuerySchema>

/** Facet fields the Sounds list can ask counts for. */
export const SOUND_FACET_FIELDS = [
  'genre',
  'tag',
  'contentType',
  'source',
  'status',
  'uploadedYear',
  'musicalKey',
] as const

export const SoundFacetsQuerySchema = SoundListFilterSchema.extend({
  fields: z
    .string()
    .trim()
    .min(1)
    .transform((raw) =>
      raw
        .split(',')
        .map((f) => f.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.enum(SOUND_FACET_FIELDS)).min(1).max(SOUND_FACET_FIELDS.length)),
})

export type SoundFacetsQuery = z.infer<typeof SoundFacetsQuerySchema>

/** Bulk delete: exactly one of `ids` or `filter` (+ confirmTotal). */
export const SoundBulkDeleteSchema = z
  .object({
    ids: z.array(z.string().min(1)).min(1).max(SOUND_BULK_MAX_IDS).optional(),
    filter: SoundListFilterSchema.optional(),
    confirmTotal: z.number().int().min(0).optional(),
    /** Required when `filter` matches every sound (empty filter). */
    all: z.boolean().optional(),
  })
  .superRefine((body, ctx) => {
    const hasIds = body.ids != null
    const hasFilter = body.filter != null
    if (hasIds === hasFilter) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "send exactly one of 'ids' or 'filter'",
      })
    }
    if (hasFilter && body.confirmTotal == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "'confirmTotal' is required with 'filter'",
        path: ['confirmTotal'],
      })
    }
  })

export type SoundBulkDeleteInput = z.infer<typeof SoundBulkDeleteSchema>

/** Fields allowed in a bulk metadata patch (no title / tracklist / URLs).
 * `tags: []` clears tags on every matched sound (replace semantics).
 * `pinned` maps to `pinnedAt` on the server (same as single PATCH). */
export const SoundBulkPatchFieldsSchema = z
  .object({
    genre: z.string().max(80).nullable().optional(),
    genreCustom: z.string().max(80).nullable().optional(),
    tags: z.array(z.string().max(40).trim()).max(20).optional(),
    subGenres: z.array(z.string().max(40).trim()).max(12).optional(),
    contentType: z.enum(SOUND_CONTENT_TYPES).optional(),
    isPublic: z.boolean().optional(),
    isFallback: z.boolean().optional(),
    pinned: z.boolean().optional(),
    downloadsEnabled: z.boolean().optional(),
    commentsEnabled: z.boolean().optional(),
    license: z.enum(SOUND_LICENSES).optional(),
    releasedAt: z.string().datetime().nullable().optional(),
  })
  .strict()

export const SoundBulkPatchSchema = z
  .object({
    ids: z.array(z.string().min(1)).min(1).max(SOUND_BULK_MAX_IDS).optional(),
    filter: SoundListFilterSchema.optional(),
    confirmTotal: z.number().int().min(0).optional(),
    all: z.boolean().optional(),
    patch: SoundBulkPatchFieldsSchema,
  })
  .superRefine((body, ctx) => {
    const hasIds = body.ids != null
    const hasFilter = body.filter != null
    if (hasIds === hasFilter) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "send exactly one of 'ids' or 'filter'",
      })
    }
    if (hasFilter && body.confirmTotal == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "'confirmTotal' is required with 'filter'",
        path: ['confirmTotal'],
      })
    }
    if (Object.keys(body.patch).length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'patch must include at least one field',
        path: ['patch'],
      })
    }
  })

export type SoundBulkPatchInput = z.infer<typeof SoundBulkPatchSchema>

/** Manual-sort reorder for the public "Tracks" tab (all sound items for a channel). */
export const ReorderSoundsSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, 'ids array is required'),
})

export type ReorderSoundsInput = z.infer<typeof ReorderSoundsSchema>
