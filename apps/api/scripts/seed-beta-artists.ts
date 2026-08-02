// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>
/**
 * Seeds 30 clearly-labeled "[BETA]" placeholder artist accounts (10 Estonia,
 * 10 Finland, 5 Latvia, 5 Vietnam) so the platform has browsable content
 * ahead of public beta. Explicitly NOT real people:
 *   - displayName is suffixed " [BETA]" so it's unambiguous in every listing.
 *   - No avatarUrl is set — the app's existing initials-fallback avatar
 *     renders instead of a photo (no real or synthetic human photo is used).
 *   - No externally-fetched audio. Each channel gets 2 archive tracks that
 *     are DB-row copies pointing at the SAME already-CC0-licensed MinIO
 *     objects Tahti Selects already legitimately hosts (safe: no unique
 *     constraint on ArchiveItem.mp3Key/flacKey, no S3 delete-cascade in this
 *     codebase — confirmed before writing this script). Original artist
 *     attribution is preserved in artistName/commentary; nothing is
 *     misattributed to the placeholder persona.
 *
 * Idempotent: looked up by email, skips accounts that already exist.
 *
 * Run (stack):  docker compose run --rm api tsx apps/api/scripts/seed-beta-artists.ts
 * Run (prod):   ssh vimage, then: docker compose exec api tsx apps/api/scripts/seed-beta-artists.ts
 */

import { randomBytes } from 'node:crypto'
import { prisma } from '@tahti/db'
import { hashPassword } from '../src/lib/password.js'
import { TAHTI_SELECTS_SLUG, VISUAL_PRESETS, type VisualPreset } from '@tahti/shared'

const AMBIENT_PRESETS = VISUAL_PRESETS.filter((p): p is VisualPreset => p !== 'MINIMAL')

function pickVisualPreset(seed: string): VisualPreset {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return AMBIENT_PRESETS[h % AMBIENT_PRESETS.length]!
}

interface CountrySpec {
  code: string
  count: number
  firstNames: string[]
  lastNames: string[]
}

// Generic, widely-common given/family names per country — not selected to
// match any specific real individual.
const COUNTRIES: CountrySpec[] = [
  {
    code: 'EE',
    count: 10,
    firstNames: [
      'Kadri',
      'Mart',
      'Liis',
      'Andres',
      'Kristiina',
      'Tõnu',
      'Mari',
      'Priit',
      'Anu',
      'Rein',
    ],
    lastNames: ['Tamm', 'Saar', 'Kask', 'Sepp', 'Mägi', 'Kukk', 'Kuusk', 'Ilves', 'Pärn', 'Org'],
  },
  {
    code: 'FI',
    count: 10,
    firstNames: [
      'Mikael',
      'Anna',
      'Juho',
      'Elina',
      'Antti',
      'Laura',
      'Timo',
      'Maria',
      'Ville',
      'Sanna',
    ],
    lastNames: [
      'Korhonen',
      'Virtanen',
      'Nieminen',
      'Mäkinen',
      'Laine',
      'Heikkinen',
      'Koskinen',
      'Järvinen',
      'Lehtonen',
      'Salo',
    ],
  },
  {
    code: 'LV',
    count: 5,
    firstNames: ['Jānis', 'Līga', 'Kārlis', 'Ilze', 'Andris'],
    lastNames: ['Bērziņš', 'Kalniņš', 'Ozols', 'Liepa', 'Zariņš'],
  },
  {
    code: 'VN',
    count: 5,
    firstNames: ['Minh', 'Linh', 'Anh', 'Huy', 'Trang'],
    lastNames: ['Nguyen', 'Tran', 'Le', 'Pham', 'Hoang'],
  },
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
  username: string
  email: string
  displayName: string
  countryCode: string
}

function buildSpecs(): ArtistSpec[] {
  const specs: ArtistSpec[] = []
  for (const country of COUNTRIES) {
    for (let i = 0; i < country.count; i++) {
      const first = country.firstNames[i % country.firstNames.length]!
      const last = country.lastNames[i % country.lastNames.length]!
      const name = `${first} ${last}`
      const slug = `${slugify(name)}-${country.code.toLowerCase()}`
      specs.push({
        username: slug,
        email: `${slug}@beta.tahti.live`,
        displayName: `${name} [BETA]`,
        countryCode: country.code,
      })
    }
  }
  return specs
}

async function ensureArtist(spec: ArtistSpec): Promise<{ channelId: string; created: boolean }> {
  const existing = await prisma.user.findUnique({
    where: { email: spec.email },
    include: { channel: true },
  })
  if (existing?.channel) return { channelId: existing.channel.id, created: false }

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
    visualPreset: pickVisualPreset(spec.username),
  }

  const created = await prisma.user.create({
    data: {
      email: spec.email,
      passwordHash: await hashPassword(randomBytes(32).toString('hex')),
      username: spec.username,
      displayName: spec.displayName,
      countryCode: spec.countryCode,
      emailVerifiedAt: new Date(),
      tier: 'FREE',
      membership: { create: { status: 'PENDING_PAYMENT' } },
      channel: { create: channelData },
    },
    include: { channel: true },
  })
  return { channelId: created.channel!.id, created: true }
}

async function main() {
  const specs = buildSpecs()

  const sourceTracks = await prisma.archiveItem.findMany({
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
  })
  if (sourceTracks.length === 0) {
    throw new Error('No READY/public Tahti Selects tracks found to attach as demo tracks')
  }

  const results: Array<{ username: string; created: boolean; tracksAttached: number }> = []
  let trackCursor = 0

  for (const spec of specs) {
    const { channelId, created } = await ensureArtist(spec)

    const existingTracks = await prisma.archiveItem.count({ where: { channelId } })
    let tracksAttached = 0
    if (existingTracks === 0) {
      for (let i = 0; i < 2; i++) {
        const source = sourceTracks[trackCursor % sourceTracks.length]!
        trackCursor++
        await prisma.archiveItem.create({
          data: {
            channelId,
            title: source.title,
            artistName: source.artistName,
            status: 'READY',
            isPublic: true,
            isFallback: true,
            fallbackOrder: i,
            license: source.license,
            qualityBadge: source.qualityBadge,
            mp3Key: source.mp3Key,
            flacKey: source.flacKey,
            bannerUrl: source.bannerUrl,
            durationSec: source.durationSec,
            fileSizeBytes: source.fileSizeBytes,
            sourceFormat: source.sourceFormat,
            sourceBitrateKbps: source.sourceBitrateKbps,
            commentary: `Demo track for a [BETA] placeholder profile — ${source.commentary ?? `originally credited to ${source.artistName}`}`,
          },
        })
        tracksAttached++
      }
    }

    results.push({ username: spec.username, created, tracksAttached })
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        totalSpecs: specs.length,
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
