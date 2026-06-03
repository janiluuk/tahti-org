// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

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

export const ReleaseTrackCatalogPatchSchema = z.object({
  id: z.string().min(1),
  isrc: z.string().max(12).nullable().optional(),
  musicbrainzRecordingId: z.string().max(64).nullable().optional(),
})

export const ReleaseCatalogPatchSchema = z
  .object({
    upc: z.string().max(20).nullable().optional(),
    musicbrainzReleaseId: z.string().max(64).nullable().optional(),
    musicbrainzArtistId: z.string().max(64).nullable().optional(),
    pLine: z.string().max(200).nullable().optional(),
    cLine: z.string().max(200).nullable().optional(),
    labelImprint: z.string().max(120).nullable().optional(),
    credits: z.array(ReleaseCreditSchema).max(40).optional(),
    tracks: z.array(ReleaseTrackCatalogPatchSchema).max(50).optional(),
  })
  .partial()

export type ReleaseCatalogPatch = z.infer<typeof ReleaseCatalogPatchSchema>

export const RELEASE_CHECKLIST_STEPS = [
  'metadata',
  'identifiers',
  'musicbrainz',
  'dsp',
  'published',
  'newsletter',
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
  tracks: Array<{ isrc: string | null; musicbrainzRecordingId?: string | null }>
}

export type ReleaseChecklistContext = {
  /** True when the artist has sent at least one newsletter (M13). */
  artistNewsletterSent?: boolean
}

export function computeReleaseChecklist(
  release: ReleaseForChecklist,
  context: ReleaseChecklistContext = {},
): ReleaseChecklistItem[] {
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
      hint: 'Store release MBID; add recording MBIDs per track when known',
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
    {
      id: 'newsletter',
      label: 'Newsletter to fans',
      done: Boolean(context.artistNewsletterSent),
      hint: 'Optional — send a release announcement from the Newsletter panel',
    },
  ]
}

/** CSV rows for label copy / Picard (track-level identifiers). */
export function buildReleaseExportCsv(pack: {
  release: {
    title: string
    type: string
    releaseDate: string
    upc: string | null
    musicbrainzReleaseId: string | null
    musicbrainzArtistId: string | null
    pLine: string | null
    cLine: string | null
    labelImprint: string | null
  }
  artist: { username: string; displayName: string }
  tracks: Array<{
    position: number
    title: string
    isrc: string | null
    musicbrainzRecordingId: string | null
    durationSec: number | null
  }>
}): string {
  const lines = [
    'position,title,isrc,musicbrainz_recording_id,duration_sec,upc,release_mbid,artist_mbid,p_line,c_line,label,artist,release_title,release_type,release_date',
  ]
  for (const t of pack.tracks) {
    lines.push(
      [
        t.position,
        csvEscape(t.title),
        csvEscape(t.isrc ?? ''),
        csvEscape(t.musicbrainzRecordingId ?? ''),
        t.durationSec ?? '',
        csvEscape(pack.release.upc ?? ''),
        csvEscape(pack.release.musicbrainzReleaseId ?? ''),
        csvEscape(pack.release.musicbrainzArtistId ?? ''),
        csvEscape(pack.release.pLine ?? ''),
        csvEscape(pack.release.cLine ?? ''),
        csvEscape(pack.release.labelImprint ?? ''),
        csvEscape(pack.artist.displayName),
        csvEscape(pack.release.title),
        pack.release.type,
        pack.release.releaseDate.slice(0, 10),
      ].join(','),
    )
  }
  return lines.join('\n') + '\n'
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

export const MUSICBRAINZ_SUBMIT_URL = 'https://musicbrainz.org/release/add'

export const MUSICBRAINZ_GUIDE_STEPS = [
  'Export JSON from the release ops panel (or copy UPC, ISRC, credits, P/C-lines).',
  'Open MusicBrainz “Add release” and choose the release type (Album, EP, Single, etc.).',
  'Enter the release title, artist credit, and date — match your Tahti release date.',
  'Add medium and tracklist rows; paste ISRCs from your export when you have them.',
  'Add label, catalog number, and barcode (UPC/EAN) if applicable.',
  'Save the release, then copy the release MBID back into Tahti.',
  'Optional: add an artist MBID for the primary artist credit.',
] as const
export const COLLECTING_SOCIETY_POINTERS = [
  {
    id: 'teosto',
    region: 'Finland',
    label: 'Teosto',
    url: 'https://www.teosto.fi/en/',
    hint: 'Register works and performers for public performance and broadcast royalties.',
  },
  {
    id: 'gramex',
    region: 'Finland',
    label: 'Gramex',
    url: 'https://www.gramex.fi/en/',
    hint: 'Neighbouring rights for recordings — register master recordings and performers.',
  },
  {
    id: 'prs',
    region: 'UK',
    label: 'PRS for Music',
    url: 'https://www.prsformusic.com/',
    hint: 'Register compositions for UK public performance and broadcast.',
  },
  {
    id: 'ppl',
    region: 'UK',
    label: 'PPL',
    url: 'https://www.ppluk.com/',
    hint: 'Register sound recordings for UK neighbouring-rights collection.',
  },
  {
    id: 'gema',
    region: 'Germany',
    label: 'GEMA',
    url: 'https://www.gema.de/en/',
    hint: 'Register musical works for German public performance rights.',
  },
  {
    id: 'ascap',
    region: 'USA',
    label: 'ASCAP',
    url: 'https://www.ascap.com/',
    hint: 'Performance rights organisation for songwriters and publishers.',
  },
  {
    id: 'bmi',
    region: 'USA',
    label: 'BMI',
    url: 'https://www.bmi.com/',
    hint: 'Alternative US PRO — register if you are a BMI affiliate.',
  },
] as const

export const POST_RELEASE_CLAIM_LINKS = [
  { id: 'spotify', label: 'Spotify for Artists', url: 'https://artists.spotify.com/' },
  { id: 'apple', label: 'Apple Music for Artists', url: 'https://artists.apple.com/' },
  {
    id: 'youtube',
    label: 'YouTube Official Artist Channel',
    url: 'https://www.youtube.com/artist',
  },
] as const
