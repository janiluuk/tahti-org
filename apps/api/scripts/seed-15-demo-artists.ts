// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>
/**
 * Seeds 15 clearly-labeled "[DEMO]" placeholder profiles (5 DJs, 5 bands,
 * 5 solo artists) so the platform has browsable content while real users
 * repopulate after the 2026-08-13 prod DB wipe. Explicitly NOT real people:
 *   - displayName is suffixed " [DEMO]" so it's unambiguous in every listing.
 *   - No avatarUrl set — the app's initials-fallback avatar renders instead.
 *   - Everything is created in draft/unpublished state (Release defaults to
 *     DRAFT; ArchiveItem sets isPublic:false) — nothing goes live until an
 *     operator reviews and publishes it.
 *
 * Audio sources (see manifest.json in AUDIO_DIR):
 *   - Most tracks are ffmpeg-sliced from a locally-prepared ambient source
 *     (placeholder demo audio, not attributed to any real artist).
 *   - A handful ("recoveredSingles") are real files recovered from a
 *     pre-wipe orchestrator disk cache (tahti_stack_archive_cache) that
 *     survived because it's a separate Docker volume from the wiped
 *     Postgres/MinIO ones. Their original title/artist metadata lived only
 *     in Postgres and was lost, so these are re-hosted with a commentary
 *     note disclosing that the original CC0 attribution is unknown —
 *     never silently presented as if newly authored.
 *
 * Idempotent: users looked up by email, releases/archive items by title.
 *
 * Expects a prepared directory (ffmpeg slicing done locally — the API image
 * has no ffmpeg):
 *   AUDIO_DIR=/tmp/demo-seed-audio tsx apps/api/scripts/seed-15-demo-artists.ts
 *
 * Run (prod): ssh vimage, then:
 *   docker cp <local-audio-dir> tahti-stack-api-1:/tmp/demo-seed-audio
 *   docker compose exec api sh -c "AUDIO_DIR=/tmp/demo-seed-audio tsx apps/api/scripts/seed-15-demo-artists.ts"
 */

import { randomBytes } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { prisma } from '@tahti/db'
import { s3, putObjectText } from '../src/lib/minio.js'
import { config } from '../src/config.js'
import { hashPassword } from '../src/lib/password.js'
import { generateCoverArtSvg } from '../src/lib/generate-cover-art.js'
import { publicMediaUrl } from '../src/lib/public-media-url.js'

interface ManifestTrack {
  title: string
  file: string
  durationSec: number
}

interface ManifestPersona {
  slug: string
  displayName: string
  kind: 'DJ' | 'BAND' | 'ARTIST'
  artistKind: 'SINGLE' | 'COLLECTIVE'
  countryCode: string
  genre: string
  bio: string
  archiveSets: ManifestTrack[]
  release: { title: string; type: 'ALBUM' | 'EP'; tracks: ManifestTrack[] } | null
}

interface Manifest {
  personas: ManifestPersona[]
  recoveredSingles: Array<{ file: string; durationSec: number; personaSlug: string }>
}

const EMAIL_DOMAIN = 'demo.tahti.live'

async function ensurePersona(p: ManifestPersona): Promise<{ userId: string; channelId: string; created: boolean }> {
  const email = `${p.slug}@${EMAIL_DOMAIN}`
  const existing = await prisma.user.findUnique({ where: { email }, include: { channel: true } })
  if (existing?.channel) return { userId: existing.id, channelId: existing.channel.id, created: false }

  const liveSourcePass = randomBytes(16).toString('hex')
  const rtmpStreamKey = randomBytes(16).toString('hex')
  const created = await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(randomBytes(32).toString('hex')),
      username: p.slug,
      displayName: `${p.displayName} [DEMO]`,
      bio: p.bio,
      countryCode: p.countryCode,
      emailVerifiedAt: new Date(),
      tier: 'FREE',
      membership: { create: { status: 'PENDING_PAYMENT' } },
      channel: {
        create: {
          slug: p.slug,
          artistKind: p.artistKind,
          liveSourceMount: `/live/${p.slug}`,
          liveSourcePass,
          liveSourcePassHash: await hashPassword(liveSourcePass),
          rtmpStreamKey,
          rtmpStreamKeyHash: await hashPassword(rtmpStreamKey),
          fallbackEnabled: true,
        },
      },
    },
    include: { channel: true },
  })
  return { userId: created.id, channelId: created.channel!.id, created: true }
}

async function uploadAudio(audioDir: string, file: string, key: string): Promise<number> {
  const buf = await readFile(path.join(audioDir, file))
  await s3.send(
    new PutObjectCommand({ Bucket: config.minio.bucket, Key: key, Body: buf, ContentType: 'audio/mpeg' }),
  )
  return buf.length
}

async function seedDjSets(
  audioDir: string,
  channelId: string,
  channelSlug: string,
  displayName: string,
  p: ManifestPersona,
): Promise<number> {
  let count = 0
  for (const set of p.archiveSets) {
    const existing = await prisma.archiveItem.findFirst({ where: { channelId, title: set.title } })
    if (existing) continue

    const item = await prisma.archiveItem.create({
      data: { channelId, title: set.title, status: 'PROCESSING', isPublic: false },
      select: { id: true },
    })
    const mp3Key = `mp3/${channelSlug}/${item.id}.mp3`
    const coverKey = `archive/${channelSlug}/${item.id}/cover.svg`
    const size = await uploadAudio(audioDir, set.file, mp3Key)
    await putObjectText(coverKey, generateCoverArtSvg(set.title, displayName), 'image/svg+xml')

    await prisma.archiveItem.update({
      where: { id: item.id },
      data: {
        status: 'READY',
        isPublic: false,
        mp3Key,
        bannerUrl: publicMediaUrl(coverKey),
        durationSec: set.durationSec,
        fileSizeBytes: BigInt(size),
        sourceFormat: 'MP3',
        genre: p.genre,
        contentType: 'DJ_MIX',
        commentary: `[DEMO] placeholder DJ set — not a real recording. Ambient placeholder audio.`,
      },
    })
    count++
  }
  return count
}

async function seedRelease(
  audioDir: string,
  userId: string,
  displayName: string,
  release: { title: string; type: 'ALBUM' | 'EP' | 'SINGLE'; tracks: ManifestTrack[] },
  genre: string,
  commentary: string,
  license?: 'ALL_RIGHTS_RESERVED' | 'CC0',
): Promise<boolean> {
  const existing = await prisma.release.findFirst({ where: { userId, title: release.title } })
  if (existing) return false

  const slugBase = `${release.title}-${displayName}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  const smartLinkSlug = `${slugBase}-${randomBytes(3).toString('hex')}`

  const coverKey = `release/${userId}/${slugBase}/cover.svg`
  await putObjectText(coverKey, generateCoverArtSvg(release.title, displayName), 'image/svg+xml')

  const created = await prisma.release.create({
    data: {
      userId,
      title: release.title,
      type: release.type,
      releaseDate: new Date(),
      genre,
      commentary,
      smartLinkSlug,
      // artworkUrl left null deliberately — resolveReleaseArtworkUrl() always
      // regenerates a fresh presigned URL from artworkKey when it's set (see
      // routes/releases/artwork.ts's attachArtwork()); a stored plain URL
      // would be both dead weight and wrong, since `release*` isn't in the
      // bucket's public-read policy (only press-kit*/archive*/avatars*/posts*).
      artworkKey: coverKey,
      // state defaults to DRAFT — deliberately left unpublished.
    },
    select: { id: true },
  })

  let position = 1
  for (const t of release.tracks) {
    const sourceKey = `release/${userId}/${created.id}/${position}/source.mp3`
    const size = await uploadAudio(audioDir, t.file, sourceKey)
    await prisma.releaseTrack.create({
      data: {
        releaseId: created.id,
        position,
        title: t.title,
        durationSec: t.durationSec,
        genre,
        sourceKey,
        sourceFormat: 'mp3',
        streamKey: sourceKey,
        status: 'READY',
        r2SizeBytes: size,
      },
    })
    position++
  }
  return true
}

async function main() {
  const audioDir = process.env.AUDIO_DIR
  if (!audioDir) throw new Error('Set AUDIO_DIR to the prepared audio directory')

  const manifest = JSON.parse(await readFile(path.join(audioDir, 'manifest.json'), 'utf8')) as Manifest

  const results: Array<{ slug: string; created: boolean; djSets: number; release: boolean; recoveredSingle: boolean }> = []

  for (const p of manifest.personas) {
    const { userId, channelId, created } = await ensurePersona(p)
    const fullDisplayName = `${p.displayName} [DEMO]`

    let djSets = 0
    if (p.kind === 'DJ') {
      djSets = await seedDjSets(audioDir, channelId, p.slug, fullDisplayName, p)
    }

    let releaseCreated = false
    if (p.release) {
      releaseCreated = await seedRelease(
        audioDir,
        userId,
        fullDisplayName,
        p.release,
        p.genre,
        `[DEMO] placeholder ${p.release.type === 'ALBUM' ? 'album' : 'EP'} — not a real release. Ambient placeholder audio.`,
      )
    }

    let recoveredSingle = false
    const recovered = manifest.recoveredSingles.find((r) => r.personaSlug === p.slug)
    if (recovered) {
      recoveredSingle = await seedRelease(
        audioDir,
        userId,
        fullDisplayName,
        {
          title: `${p.displayName} — Legacy Session`,
          type: 'SINGLE',
          tracks: [{ title: `${p.displayName} — Legacy Session`, file: recovered.file, durationSec: recovered.durationSec }],
        },
        p.genre,
        '[DEMO] Recovered audio — originally a CC0-licensed Tahti Selects track. The original ' +
          'title/artist attribution lived only in Postgres and was lost in the 2026-08-13 ' +
          'database wipe; only the audio file itself survived (a separate, un-wiped disk cache ' +
          'volume). Re-hosted here as demo content with attribution disclosed as unknown — ' +
          'do not present as newly authored work.',
        'CC0',
      )
    }

    results.push({ slug: p.slug, created, djSets, release: releaseCreated, recoveredSingle })
  }

  const totalItems =
    results.reduce((n, r) => n + r.djSets, 0) +
    manifest.personas.reduce((n, p) => n + (p.release?.tracks.length ?? 0), 0) +
    manifest.recoveredSingles.length

  console.log(JSON.stringify({ ok: true, personas: results.length, totalItems, results }, null, 2))
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
