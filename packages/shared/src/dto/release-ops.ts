// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const RELEASE_CREDIT_ROLES = [
  'writer',
  'composer',
  'performer',
  'producer',
  'remixer',
  'engineer',
  'label',
] as const

export const ReleaseCreditSchema = z.object({
  role: z.enum(RELEASE_CREDIT_ROLES),
  name: z.string().min(1).max(120),
  artistUsername: z
    .string()
    .regex(/^[a-z0-9_-]{2,32}$/i)
    .optional(),
})

export type ReleaseCredit = z.infer<typeof ReleaseCreditSchema>

export const ReleaseCatalogPatchSchema = z
  .object({
    upc: z.string().max(20).nullable().optional(),
    musicbrainzReleaseId: z.string().max(64).nullable().optional(),
    musicbrainzArtistId: z.string().max(64).nullable().optional(),
    pLine: z.string().max(200).nullable().optional(),
    cLine: z.string().max(200).nullable().optional(),
    labelImprint: z.string().max(120).nullable().optional(),
    credits: z.array(ReleaseCreditSchema).max(40).optional(),
  })
  .partial()

export type ReleaseCatalogPatch = z.infer<typeof ReleaseCatalogPatchSchema>

export const RELEASE_CHECKLIST_STEPS = [
  'metadata',
  'identifiers',
  'musicbrainz',
  'dsp',
  'published',
] as const

export type ReleaseChecklistStep = (typeof RELEASE_CHECKLIST_STEPS)[number]

export interface ReleaseChecklistItem {
  id: ReleaseChecklistStep
  label: string
  done: boolean
  hint?: string
}

export interface ReleaseForChecklist {
  title: string
  releaseDate: Date
  description: string | null
  artworkUrl: string | null
  state: string
  upc: string | null
  musicbrainzReleaseId: string | null
  revelatorStatus: string | null
  smartLinkTargets: unknown
  tracks: Array<{ isrc: string | null }>
}

export function computeReleaseChecklist(release: ReleaseForChecklist): ReleaseChecklistItem[] {
  const hasTargets =
    release.smartLinkTargets &&
    typeof release.smartLinkTargets === 'object' &&
    Object.keys(release.smartLinkTargets as object).length > 0

  const metadataDone =
    Boolean(release.title?.trim()) && Boolean(release.releaseDate) && release.tracks.length > 0

  const identifiersDone =
    Boolean(release.upc?.trim()) || release.tracks.every((t) => Boolean(t.isrc?.trim()))

  const musicbrainzDone = Boolean(release.musicbrainzReleaseId?.trim())

  const dspDone =
    release.revelatorStatus === 'delivered' ||
    release.revelatorStatus === 'submitted' ||
    Boolean(hasTargets)

  const publishedDone = release.state === 'PUBLISHED'

  return [
    {
      id: 'metadata',
      label: 'Release metadata',
      done: metadataDone,
      hint: 'Title, date, description, artwork, and at least one track',
    },
    {
      id: 'identifiers',
      label: 'UPC / ISRC',
      done: identifiersDone,
      hint: 'UPC on the release or ISRC on every track',
    },
    {
      id: 'musicbrainz',
      label: 'MusicBrainz',
      done: musicbrainzDone,
      hint: 'Optional — store MBID after open-catalog submission',
    },
    {
      id: 'dsp',
      label: 'DSP / smart links',
      done: dspDone,
      hint: 'Revelator submitted or platform URLs on the smart link',
    },
    {
      id: 'published',
      label: 'Published on profile',
      done: publishedDone,
      hint: 'Release state is PUBLISHED',
    },
  ]
}

export const MUSICBRAINZ_SUBMIT_URL = 'https://musicbrainz.org/release/add'
export const POST_RELEASE_CLAIM_LINKS = [
  { id: 'spotify', label: 'Spotify for Artists', url: 'https://artists.spotify.com/' },
  { id: 'apple', label: 'Apple Music for Artists', url: 'https://artists.apple.com/' },
  {
    id: 'youtube',
    label: 'YouTube Official Artist Channel',
    url: 'https://www.youtube.com/artist',
  },
] as const
