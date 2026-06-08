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

export const ReleaseCatalogPatchSchema = z
  .object({
    upc: z.string().max(20).nullable().optional(),
    musicbrainzReleaseId: z.string().max(64).nullable().optional(),
    musicbrainzArtistId: z.string().max(64).nullable().optional(),
    discogsReleaseId: z.string().max(64).nullable().optional(),
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

export interface MusicBrainzPrefillRelease {
  title: string
  type: string
  releaseDate: Date
  description: string | null
  upc: string | null
  pLine: string | null
  cLine: string | null
  labelImprint: string | null
  credits: unknown
  tracks: Array<{ position: number; title: string; isrc: string | null }>
  user: { username: string; displayName: string }
}

/** Plain-text clipboard helper for MusicBrainz “Add release” (M30). */
export function buildMusicBrainzPrefill(release: MusicBrainzPrefillRelease): string {
  const date = release.releaseDate.toISOString().slice(0, 10)
  const credits = Array.isArray(release.credits)
    ? (release.credits as ReleaseCredit[])
        .filter((c) => c?.name?.trim())
        .map((c) => `${c.role}: ${c.name}`)
    : []

  const lines = [
    '=== Tahti → MusicBrainz prefill ===',
    `Release title: ${release.title}`,
    `Release type: ${release.type}`,
    `Release date: ${date}`,
    `Artist credit: ${release.user.displayName} (@${release.user.username})`,
    release.description ? `Annotation: ${release.description}` : null,
    release.upc ? `Barcode (UPC/EAN): ${release.upc}` : null,
    release.labelImprint ? `Label: ${release.labelImprint}` : null,
    release.pLine ? `P-line: ${release.pLine}` : null,
    release.cLine ? `C-line: ${release.cLine}` : null,
    credits.length > 0 ? `Credits:\n${credits.map((c) => `  - ${c}`).join('\n')}` : null,
    '',
    'Tracklist:',
    ...release.tracks.map((t) => `  ${t.position}. ${t.title}${t.isrc ? ` — ISRC ${t.isrc}` : ''}`),
    '',
    `Submit: ${MUSICBRAINZ_SUBMIT_URL}`,
  ]

  return lines.filter((line): line is string => line !== null).join('\n')
}

export const MUSICBRAINZ_GUIDE_STEPS = [
  'Export JSON from the release ops panel (or copy UPC, ISRC, credits, P/C-lines).',
  'Open MusicBrainz “Add release” and choose the release type (Album, EP, Single, etc.).',
  'Enter the release title, artist credit, and date — match your Tahti release date.',
  'Add medium and tracklist rows; paste ISRCs from your export when you have them.',
  'Add label, catalog number, and barcode (UPC/EAN) if applicable.',
  'Save the release, then copy the release MBID back into Tahti.',
  'Optional: add an artist MBID for the primary artist credit.',
] as const

export const DISCOGS_SUBMIT_URL = 'https://www.discogs.com/search/'

export interface DiscogsPrefillRelease {
  title: string
  releaseDate: Date
  description: string | null
  upc: string | null
  labelImprint: string | null
  pLine: string | null
  cLine: string | null
  credits: unknown
  tracks: Array<{ position: number; title: string; durationSec: number | null }>
  user: { username: string; displayName: string }
}

/** Plain-text clipboard helper for a guided Discogs database submission (M30). */
export function buildDiscogsPrefill(release: DiscogsPrefillRelease): string {
  const date = release.releaseDate.toISOString().slice(0, 10)
  const credits = Array.isArray(release.credits)
    ? (release.credits as ReleaseCredit[])
        .filter((c) => c?.name?.trim())
        .map((c) => `${c.role}: ${c.name}`)
    : []

  function formatDuration(seconds: number | null): string {
    if (seconds == null) return ''
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return ` (${m}:${String(s).padStart(2, '0')})`
  }

  const lines = [
    '=== Tahti → Discogs prefill ===',
    `Title: ${release.title}`,
    `Artist: ${release.user.displayName} (@${release.user.username})`,
    `Released: ${date}`,
    `Format: Digital, ${release.tracks.length} ${release.tracks.length === 1 ? 'track' : 'tracks'}`,
    release.labelImprint ? `Label: ${release.labelImprint}` : null,
    release.upc ? `Barcode: ${release.upc}` : null,
    release.pLine ? `P-line: ${release.pLine}` : null,
    release.cLine ? `C-line: ${release.cLine}` : null,
    credits.length > 0 ? `Credits:\n${credits.map((c) => `  - ${c}`).join('\n')}` : null,
    '',
    'Tracklist:',
    ...release.tracks.map((t) => `  ${t.position}. ${t.title}${formatDuration(t.durationSec)}`),
    '',
    `Submission notes: Released independently by ${release.user.displayName} via Tahti (${release.user.username}); entered from the artist's own metadata.`,
    `Search Discogs first to avoid duplicates: ${DISCOGS_SUBMIT_URL}`,
  ]

  return lines.filter((line): line is string => line !== null).join('\n')
}

export const DISCOGS_GUIDE_STEPS = [
  'Export JSON from the release ops panel (or copy title, label, barcode, and credits).',
  'Search Discogs for this artist and release title first — only add it if it is missing.',
  'Open the artist (or label) page and use “Submit a New Release” to reach the Add Release form.',
  'Enter title, label, format (e.g. Digital, File), country, and release date — match Tahti.',
  'Add the tracklist in order with track durations from your export.',
  'Add the barcode (UPC/EAN) and catalog number if applicable.',
  'Write Submission Notes explaining the source — Discogs requires this for every new release.',
  'Submit for community review, then copy the release URL or numeric ID back into Tahti.',
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
