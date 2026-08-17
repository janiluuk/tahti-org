// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>
/**
 * Seeds 16 clearly-labeled "[BETA]" placeholder artist accounts — an even 4
 * per country (Estonia, Finland, Latvia, Vietnam) — so the platform has
 * browsable, varied content ahead of public beta. Explicitly NOT real people:
 *   - displayName is suffixed " [BETA]" so it's unambiguous in every listing.
 *   - No avatarUrl is set — the app's existing initials-fallback avatar
 *     renders instead of a photo (no real or synthetic human photo is used).
 *   - No externally-fetched audio. Each channel's content (album, DJ set,
 *     live show, single) is a DB-row copy pointing at the SAME
 *     already-CC0-licensed MinIO objects Tahti Selects already legitimately
 *     hosts (safe: no unique constraint on ArchiveItem.mp3Key/flacKey, no S3
 *     delete-cascade in this codebase — confirmed before writing this
 *     script). Original artist attribution is preserved in
 *     artistName/commentary; nothing is misattributed to the placeholder
 *     persona. DJ-set/live-show recontextualization is disclosed in
 *     commentary too — the underlying recording is still a CC0 studio track.
 *   - Cover art is a freshly generated gradient SVG per release/set (see
 *     generate-cover-art.ts) — a real, distinct thumbnail per item, not a
 *     shared placeholder image.
 *   - Each channel gets a deliberately distinct "channel design preset":
 *     a Three.js visualizer preset, brand accent swatch, and header style,
 *     assigned round-robin by index so the 16 channels showcase the range
 *     of customization options rather than all looking the same.
 *
 * Idempotent: users looked up by email; releases/archive items by title.
 *
 * Run (stack):  docker compose run --rm api tsx apps/api/scripts/seed-beta-artists.ts
 * Run (prod):   ssh vimage, then: docker compose exec api tsx apps/api/scripts/seed-beta-artists.ts
 */

import { randomBytes } from 'node:crypto'
import { prisma } from '@tahti/db'
import { hashPassword } from '../src/lib/password.js'
import { generateCoverArtSvg } from '../src/lib/generate-cover-art.js'
import { putObjectText } from '../src/lib/minio.js'
import { publicMediaUrl } from '../src/lib/public-media-url.js'
import {
  TAHTI_SELECTS_SLUG,
  VISUAL_PRESETS,
  BRAND_ACCENT_PRESETS,
  DEFAULT_COLOR_SCHEME,
  type VisualPreset,
} from '@tahti/shared'

interface CountrySpec {
  code: string
  name: string
  firstNames: string[]
  lastNames: string[]
}

const ARTISTS_PER_COUNTRY = 4

// Generic, widely-common given/family names per country — not selected to
// match any specific real individual.
const COUNTRIES: CountrySpec[] = [
  {
    code: 'EE',
    name: 'Estonia',
    firstNames: ['Kadri', 'Mart', 'Liis', 'Andres'],
    lastNames: ['Tamm', 'Saar', 'Kask', 'Sepp'],
  },
  {
    code: 'FI',
    name: 'Finland',
    firstNames: ['Mikael', 'Anna', 'Juho', 'Elina'],
    lastNames: ['Korhonen', 'Virtanen', 'Nieminen', 'Mäkinen'],
  },
  {
    code: 'LV',
    name: 'Latvia',
    firstNames: ['Jānis', 'Līga', 'Kārlis', 'Ilze'],
    lastNames: ['Bērziņš', 'Kalniņš', 'Ozols', 'Liepa'],
  },
  {
    code: 'VN',
    name: 'Vietnam',
    firstNames: ['Minh', 'Linh', 'Anh', 'Huy'],
    lastNames: ['Nguyen', 'Tran', 'Le', 'Pham'],
  },
]

const GENRES = ['Ambient', 'Electronic', 'Downtempo', 'Lo-fi', 'Synthwave', 'Experimental']

// One evocative album title per persona (index-keyed) — keeps titles from
// colliding since Release lookups are idempotent by (userId, title).
const ALBUM_TITLES = [
  'Night Drift',
  'Slow Static',
  'Faded Blue',
  'Glass Horizon',
  'Quiet Static',
  'Low Tide',
  'Paper Moon',
  'After Hours',
  'Bright Static',
  'Soft Focus',
  'Wide Awake',
  'Halflight',
  'Loose Ends',
  'Faint Signal',
  'Open Water',
  'Still Frame',
]

const SINGLE_TITLES = [
  'Undertow',
  'Nightbus',
  'Afterglow',
  'Sea Glass',
  'Static Bloom',
  'Cold Room',
  'First Light',
  'Backroads',
  'Neon Rain',
  'Empty Platform',
  'Slow Burn',
  'Grey Hour',
  'Departure',
  'Wire & Water',
  'Ember',
  'Last Train',
]

function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

interface ArtistSpec {
  index: number
  username: string
  email: string
  displayName: string
  countryCode: string
  countryName: string
  genre: string
  visualPreset: VisualPreset
  headerStyle: 'GRADIENT' | 'SOLID'
  brandAccentId: string
  colorSchemeJson: string
}

function buildSpecs(): ArtistSpec[] {
  const specs: ArtistSpec[] = []
  let index = 0
  for (const country of COUNTRIES) {
    for (let i = 0; i < ARTISTS_PER_COUNTRY; i++) {
      const first = country.firstNames[i % country.firstNames.length]!
      const last = country.lastNames[i % country.lastNames.length]!
      const name = `${first} ${last}`
      const slug = `${slugify(name)}-${country.code.toLowerCase()}`
      const accent = BRAND_ACCENT_PRESETS[index % BRAND_ACCENT_PRESETS.length]!
      const colorScheme = {
        ...DEFAULT_COLOR_SCHEME,
        accent: accent.accent,
        highlight: accent.highlight,
      }
      specs.push({
        index,
        username: slug,
        email: `${slug}@beta.tahti.live`,
        displayName: `${name} [BETA]`,
        countryCode: country.code,
        countryName: country.name,
        genre: GENRES[index % GENRES.length]!,
        visualPreset: VISUAL_PRESETS[index % VISUAL_PRESETS.length]!,
        headerStyle: index % 2 === 0 ? 'GRADIENT' : 'SOLID',
        brandAccentId: accent.id,
        colorSchemeJson: JSON.stringify(colorScheme),
      })
      index++
    }
  }
  return specs
}

async function ensureArtist(spec: ArtistSpec): Promise<{
  userId: string
  channelId: string
  channelSlug: string
  created: boolean
}> {
  const existing = await prisma.user.findUnique({
    where: { email: spec.email },
    include: { channel: true },
  })
  if (existing?.channel) {
    return {
      userId: existing.id,
      channelId: existing.channel.id,
      channelSlug: existing.channel.slug,
      created: false,
    }
  }

  const liveSourcePass = randomBytes(16).toString('hex')
  const rtmpStreamKey = randomBytes(16).toString('hex')
  const channelData = {
    slug: spec.username,
    liveSourceMount: `/live/${spec.username}`,
    liveSourcePass,
    liveSourcePassHash: await hashPassword(liveSourcePass),
    rtmpStreamKey,
    rtmpStreamKeyHash: await hashPassword(rtmpStreamKey),
    fallbackEnabled: true,
    visualPreset: spec.visualPreset,
    headerStyle: spec.headerStyle,
    brandAccentPreset: spec.brandAccentId,
    colorSchemeJson: spec.colorSchemeJson,
  }

  const created = await prisma.user.create({
    data: {
      email: spec.email,
      passwordHash: await hashPassword(randomBytes(32).toString('hex')),
      username: spec.username,
      displayName: spec.displayName,
      bio: `Independent artist based in ${spec.countryName}.`,
      countryCode: spec.countryCode,
      emailVerifiedAt: new Date(),
      tier: 'FREE',
      membership: { create: { status: 'PENDING_PAYMENT' } },
      channel: { create: channelData },
    },
    include: { channel: true },
  })
  return {
    userId: created.id,
    channelId: created.channel!.id,
    channelSlug: created.channel!.slug,
    created: true,
  }
}

interface SourceTrack {
  title: string
  artistName: string | null
  mp3Key: string | null
  flacKey: string | null
  bannerUrl: string | null
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

/** Simple round-robin cursor over the CC0 source pool — shared across all
 * personas/content so track selection & ordering vary between artists. */
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

async function seedAlbum(
  spec: ArtistSpec,
  userId: string,
  cursor: ReturnType<typeof makeCursor>,
  pool: SourceTrack[],
): Promise<boolean> {
  const title = ALBUM_TITLES[spec.index % ALBUM_TITLES.length]!
  const existing = await prisma.release.findFirst({ where: { userId, title } })
  if (existing) return false

  const slugBase = `${title}-${spec.username}`.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const smartLinkSlug = `${slugBase}-${randomBytes(3).toString('hex')}`
  const coverKey = `release/${userId}/${slugBase}/cover.svg`
  await putObjectText(coverKey, generateCoverArtSvg(title, spec.displayName), 'image/svg+xml')

  const trackCount = Math.min(4, pool.length)
  const created = await prisma.release.create({
    data: {
      userId,
      title,
      type: 'ALBUM',
      releaseDate: new Date(),
      genre: spec.genre,
      commentary: `[BETA] placeholder album — not a real release. Tracks are CC0 placeholder audio.`,
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
        genre: spec.genre,
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

async function seedSingle(
  spec: ArtistSpec,
  userId: string,
  cursor: ReturnType<typeof makeCursor>,
): Promise<boolean> {
  const title = SINGLE_TITLES[spec.index % SINGLE_TITLES.length]!
  const existing = await prisma.release.findFirst({ where: { userId, title } })
  if (existing) return false

  const slugBase = `${title}-${spec.username}`.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const smartLinkSlug = `${slugBase}-${randomBytes(3).toString('hex')}`
  const coverKey = `release/${userId}/${slugBase}/cover.svg`
  await putObjectText(coverKey, generateCoverArtSvg(title, spec.displayName), 'image/svg+xml')

  const source = cursor.next()
  const created = await prisma.release.create({
    data: {
      userId,
      title,
      type: 'SINGLE',
      releaseDate: new Date(),
      genre: spec.genre,
      commentary: `[BETA] placeholder single — not a real release. CC0 placeholder audio.`,
      smartLinkSlug,
      artworkKey: coverKey,
      state: 'PUBLISHED',
      publishedAt: new Date(),
    },
    select: { id: true },
  })

  await prisma.releaseTrack.create({
    data: {
      releaseId: created.id,
      position: 1,
      title: source.title,
      durationSec: source.durationSec,
      genre: spec.genre,
      sourceKey: source.mp3Key,
      sourceFormat: source.sourceFormat ?? 'mp3',
      streamKey: source.mp3Key,
      status: 'READY',
      r2SizeBytes: source.fileSizeBytes ? Number(source.fileSizeBytes) : null,
    },
  })
  return true
}

async function seedArchiveSet(
  spec: ArtistSpec,
  channelId: string,
  channelSlug: string,
  title: string,
  contentType: 'DJ_MIX' | 'LIVE',
  cursor: ReturnType<typeof makeCursor>,
): Promise<boolean> {
  const existing = await prisma.archiveItem.findFirst({ where: { channelId, title } })
  if (existing) return false

  const source = cursor.next()
  const coverKey = `archive/${channelSlug}/${slugify(title)}-${randomBytes(3).toString('hex')}/cover.svg`
  await putObjectText(coverKey, generateCoverArtSvg(title, spec.displayName), 'image/svg+xml')

  const kind = contentType === 'DJ_MIX' ? 'DJ set' : 'live show'
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
      genre: spec.genre,
      contentType,
      commentary:
        `[BETA] placeholder ${kind} for a demo profile — recontextualized CC0 studio ` +
        `recording, not an actual recorded ${kind}. ${source.commentary ?? `Originally credited to ${source.artistName}.`}`,
    },
  })
  return true
}

async function main() {
  const specs = buildSpecs()

  const sourceTracks = (await prisma.archiveItem.findMany({
    where: { channel: { slug: TAHTI_SELECTS_SLUG }, status: 'READY', isPublic: true },
    select: {
      title: true,
      artistName: true,
      mp3Key: true,
      flacKey: true,
      bannerUrl: true,
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
    country: string
    created: boolean
    album: boolean
    single: boolean
    djSet: boolean
    liveShow: boolean
    visualPreset: string
  }> = []

  for (const spec of specs) {
    const { userId, channelId, channelSlug, created } = await ensureArtist(spec)
    const cursor = makeCursor(sourceTracks)

    const album = await seedAlbum(spec, userId, cursor, sourceTracks)
    const single = await seedSingle(spec, userId, cursor)
    const djSet = await seedArchiveSet(
      spec,
      channelId,
      channelSlug,
      `${spec.displayName.replace(' [BETA]', '')} — DJ Set`,
      'DJ_MIX',
      cursor,
    )
    const liveShow = await seedArchiveSet(
      spec,
      channelId,
      channelSlug,
      `${spec.displayName.replace(' [BETA]', '')} — Live Session`,
      'LIVE',
      cursor,
    )

    results.push({
      username: spec.username,
      country: spec.countryCode,
      created,
      album,
      single,
      djSet,
      liveShow,
      visualPreset: spec.visualPreset,
    })
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        totalSpecs: specs.length,
        perCountry: ARTISTS_PER_COUNTRY,
        created: results.filter((r) => r.created).length,
        alreadyExisted: results.filter((r) => !r.created).length,
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
