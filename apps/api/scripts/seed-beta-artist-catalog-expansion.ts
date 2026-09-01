// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>
/**
 * Expands the catalog of the existing 16 "[BETA]" placeholder artists
 * (seeded by seed-beta-artists.ts) with 3 more releases and 4 more archive
 * items each, so the platform reads as an active, populated service for a
 * community demo. Same legal/labeling footing as seed-beta-artists.ts:
 *   - No new accounts, no new audio files. Every new row points at the same
 *     already-CC0-licensed Tahti Selects MinIO objects — attribution is
 *     preserved in commentary, nothing is misattributed to the placeholder
 *     persona.
 *   - Cover art is a freshly generated gradient SVG per release/set.
 *   - Genre is read back from the artist's existing release so new content
 *     matches what's already on their profile.
 *
 * Idempotent: releases/archive items looked up by (userId or channelId, title).
 *
 * Run (prod): ssh vimage, then:
 *   docker compose exec api tsx apps/api/scripts/seed-beta-artist-catalog-expansion.ts
 */

import { randomBytes } from 'node:crypto'
import { prisma } from '@tahti/db'
import { generateCoverArtSvg } from '../src/lib/generate-cover-art.js'
import { putObjectText } from '../src/lib/minio.js'
import { publicMediaUrl } from '../src/lib/public-media-url.js'
import { TAHTI_SELECTS_SLUG } from '@tahti/shared'

const EP_TITLES = [
  'Drift Report',
  'Warm Static',
  'Pale Circuit',
  'Shortwave',
  'Salt Air',
  'Amber Light',
  'Loose Thread',
  'Northbound',
  'Faint Echo',
  'Grey Tide',
  'Open Frequency',
  'Winter Static',
  'Slow Reveal',
  'Cloud Cover',
  'Analog Drift',
  'Hollow Bell',
]

const SECOND_EP_TITLES = [
  'Late Arrival',
  'Quiet Coast',
  'Radio Silence',
  'Faded Signal',
  'Blue Hour',
  'Distant Shore',
  'Paper Trail',
  'Night Frequency',
  'Soft Static',
  'Cold Signal',
  'Afterlight',
  'Long Exposure',
  'Bloom Static',
  'Wandering Light',
  'Faint Static',
  'Slow Fade',
]

const SECOND_SINGLE_TITLES = [
  'Tideline',
  'Skylark',
  'Runoff',
  'Nightcap',
  'Halide',
  'Windowseat',
  'Overcast',
  'Marrow',
  'Verglas',
  'Aftertaste',
  'Causeway',
  'Milkweed',
  'Undertone',
  'Waypoint',
  'Cordillera',
  'Threshold',
]

const ARCHIVE_SET_SPECS: Array<{
  suffix: string
  contentType: 'SHOW' | 'LIVE' | 'TRACK' | 'REMIX'
  kind: string
}> = [
  { suffix: 'Radio Session', contentType: 'SHOW', kind: 'radio session' },
  { suffix: 'Acoustic Set', contentType: 'LIVE', kind: 'acoustic set' },
  { suffix: 'B-Sides & Demos', contentType: 'TRACK', kind: 'demo session' },
  { suffix: 'Remix Session', contentType: 'REMIX', kind: 'remix session' },
]

function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

interface SourceTrack {
  title: string
  artistName: string | null
  mp3Key: string | null
  flacKey: string | null
  durationSec: number | null
  fileSizeBytes: bigint | null
  sourceFormat: string | null
  sourceBitrateKbps: number | null
  license:
    | 'ALL_RIGHTS_RESERVED'
    | 'CC_BY'
    | 'CC_BY_NC'
    | 'CC_BY_NC_SA'
    | 'CC_BY_NC_ND'
    | 'CC_BY_SA'
    | 'CC0'
  qualityBadge: 'LOSSLESS' | 'TRANSCODED' | 'EMBED_ONLY'
  commentary: string | null
}

function makeCursor(pool: SourceTrack[]) {
  let n = 0
  return {
    next(): SourceTrack {
      const t = pool[n % pool.length]!
      n++
      return t
    },
  }
}

async function seedRelease(
  userId: string,
  username: string,
  displayName: string,
  title: string,
  type: 'EP' | 'SINGLE',
  trackCount: number,
  genre: string,
  cursor: ReturnType<typeof makeCursor>,
): Promise<boolean> {
  const existing = await prisma.release.findFirst({ where: { userId, title } })
  if (existing) return false

  const slugBase = `${title}-${username}`.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const smartLinkSlug = `${slugBase}-${randomBytes(3).toString('hex')}`
  const coverKey = `release/${userId}/${slugBase}/cover.svg`
  await putObjectText(coverKey, generateCoverArtSvg(title, displayName), 'image/svg+xml')

  const created = await prisma.release.create({
    data: {
      userId,
      title,
      type,
      releaseDate: new Date(),
      genre,
      commentary: `[BETA] placeholder ${type === 'EP' ? 'EP' : 'single'} — not a real release. Tracks are CC0 placeholder audio.`,
      smartLinkSlug,
      artworkKey: coverKey,
      state: 'PUBLISHED',
      publishedAt: new Date(),
    },
    select: { id: true },
  })

  for (let position = 1; position <= trackCount; position++) {
    const source = cursor.next()
    await prisma.releaseTrack.create({
      data: {
        releaseId: created.id,
        position,
        title: source.title,
        durationSec: source.durationSec,
        genre,
        sourceKey: source.mp3Key,
        sourceFormat: source.sourceFormat ?? 'mp3',
        streamKey: source.mp3Key,
        status: 'READY',
        r2SizeBytes: source.fileSizeBytes ? Number(source.fileSizeBytes) : null,
      },
    })
  }
  return true
}

async function seedArchiveSet(
  channelId: string,
  channelSlug: string,
  displayName: string,
  title: string,
  contentType: 'SHOW' | 'LIVE' | 'TRACK' | 'REMIX',
  kind: string,
  genre: string,
  cursor: ReturnType<typeof makeCursor>,
): Promise<boolean> {
  const existing = await prisma.archiveItem.findFirst({ where: { channelId, title } })
  if (existing) return false

  const source = cursor.next()
  const coverKey = `archive/${channelSlug}/${slugify(title)}-${randomBytes(3).toString('hex')}/cover.svg`
  await putObjectText(coverKey, generateCoverArtSvg(title, displayName), 'image/svg+xml')

  await prisma.archiveItem.create({
    data: {
      channelId,
      title,
      status: 'READY',
      isPublic: true,
      license: source.license,
      qualityBadge: source.qualityBadge,
      mp3Key: source.mp3Key,
      flacKey: source.flacKey,
      bannerUrl: publicMediaUrl(coverKey),
      durationSec: source.durationSec,
      fileSizeBytes: source.fileSizeBytes,
      sourceFormat: source.sourceFormat,
      sourceBitrateKbps: source.sourceBitrateKbps,
      genre,
      contentType,
      commentary:
        `[BETA] placeholder ${kind} for a demo profile — recontextualized CC0 studio ` +
        `recording, not an actual recorded ${kind}. ${source.commentary ?? `Originally credited to ${source.artistName}.`}`,
    },
  })
  return true
}

async function main() {
  const artists = await prisma.user.findMany({
    where: { email: { endsWith: '@beta.tahti.live' } },
    include: { channel: true },
    orderBy: { username: 'asc' },
  })
  if (artists.length === 0) throw new Error('No @beta.tahti.live artists found')

  const sourceTracks = (await prisma.archiveItem.findMany({
    where: { channel: { slug: TAHTI_SELECTS_SLUG }, status: 'READY', isPublic: true },
    select: {
      title: true,
      artistName: true,
      mp3Key: true,
      flacKey: true,
      durationSec: true,
      fileSizeBytes: true,
      sourceFormat: true,
      sourceBitrateKbps: true,
      license: true,
      qualityBadge: true,
      commentary: true,
    },
  })) as SourceTrack[]
  if (sourceTracks.length === 0) {
    throw new Error('No READY/public Tahti Selects tracks found to build demo content from')
  }

  const results: Array<{
    username: string
    ep1: boolean
    ep2: boolean
    single: boolean
    archiveSets: number
  }> = []

  for (let index = 0; index < artists.length; index++) {
    const artist = artists[index]!
    if (!artist.channel || !artist.username) continue
    const channel = artist.channel
    const cursor = makeCursor(sourceTracks)
    const displayName = artist.displayName ?? artist.username
    const displayBase = displayName.replace(' [BETA]', '')

    const anyRelease = await prisma.release.findFirst({
      where: { userId: artist.id },
      select: { genre: true },
    })
    const genre = anyRelease?.genre ?? 'Ambient'

    const ep1 = await seedRelease(
      artist.id,
      artist.username,
      displayName,
      EP_TITLES[index % EP_TITLES.length]!,
      'EP',
      5,
      genre,
      cursor,
    )
    const ep2 = await seedRelease(
      artist.id,
      artist.username,
      displayName,
      SECOND_EP_TITLES[index % SECOND_EP_TITLES.length]!,
      'EP',
      4,
      genre,
      cursor,
    )
    const single = await seedRelease(
      artist.id,
      artist.username,
      displayName,
      SECOND_SINGLE_TITLES[index % SECOND_SINGLE_TITLES.length]!,
      'SINGLE',
      1,
      genre,
      cursor,
    )

    let archiveSets = 0
    for (const spec of ARCHIVE_SET_SPECS) {
      const added = await seedArchiveSet(
        channel.id,
        channel.slug,
        displayName,
        `${displayBase} — ${spec.suffix}`,
        spec.contentType,
        spec.kind,
        genre,
        cursor,
      )
      if (added) archiveSets++
    }

    results.push({ username: artist.username, ep1, ep2, single, archiveSets })
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        artists: results.length,
        newReleases: results.reduce(
          (n, r) => n + (r.ep1 ? 1 : 0) + (r.ep2 ? 1 : 0) + (r.single ? 1 : 0),
          0,
        ),
        newArchiveItems: results.reduce((n, r) => n + r.archiveSets, 0),
        results,
      },
      null,
      2,
    ),
  )
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
