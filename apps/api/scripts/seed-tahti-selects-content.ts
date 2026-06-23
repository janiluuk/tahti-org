// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>
/**
 * Idempotent seed for the Tahti Selects channel: a system user + channel, a
 * persistent placeholder Broadcast (keeps the channel-watchdog / orchestrator
 * restart path working without a real live source), and an initial CC0
 * rotation downloaded from Wikimedia Commons (license verified via the
 * Commons API extmetadata field at the time this script was written — see
 * sourcePage on each track for the canonical file page).
 *
 * Run (stack): docker compose run --rm api tsx apps/api/scripts/seed-tahti-selects-content.ts
 */

import { randomBytes } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { prisma } from '@tahti/db'
import { TAHTI_SELECTS_SLUG } from '@tahti/shared'
import { hashPassword } from '../src/lib/password.js'
import { s3 } from '../src/lib/minio.js'
import { config } from '../src/config.js'

const execFileAsync = promisify(execFile)
const SYSTEM_EMAIL = 'tahti-selects@system.tahti.live'

interface SeedTrack {
  title: string
  artist: string
  sourceUrl: string
  sourcePage: string
}

// All CC0 1.0 Universal (Public Domain Dedication), verified via the Wikimedia
// Commons API extmetadata.LicenseShortName field before inclusion.
const TRACKS: SeedTrack[] = [
  {
    title: 'Monster Parade',
    artist: 'Loyalty Freak Music',
    sourceUrl:
      'https://upload.wikimedia.org/wikipedia/commons/1/1b/Loyalty_Freak_Music_-_01_-_Monster_Parade.ogg',
    sourcePage:
      'https://commons.wikimedia.org/wiki/File:Loyalty_Freak_Music_-_01_-_Monster_Parade.ogg',
  },
  {
    title: 'A Ghost Waltz',
    artist: 'Loyalty Freak Music',
    sourceUrl:
      'https://upload.wikimedia.org/wikipedia/commons/a/a2/Loyalty_Freak_Music_-_02_-_A_ghost_Waltz.ogg',
    sourcePage:
      'https://commons.wikimedia.org/wiki/File:Loyalty_Freak_Music_-_02_-_A_ghost_Waltz.ogg',
  },
  {
    title: 'Everyone',
    artist: 'Loyalty Freak Music',
    sourceUrl:
      'https://upload.wikimedia.org/wikipedia/commons/c/c4/Loyalty_Freak_Music_-_02_-_Everyone.ogg',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Loyalty_Freak_Music_-_02_-_Everyone.ogg',
  },
  {
    title: 'After Party',
    artist: 'Loyalty Freak Music',
    sourceUrl:
      'https://upload.wikimedia.org/wikipedia/commons/4/43/Loyalty_Freak_Music_-_03_-_After_Party.ogg',
    sourcePage:
      'https://commons.wikimedia.org/wiki/File:Loyalty_Freak_Music_-_03_-_After_Party.ogg',
  },
  {
    title: 'Static Shoes',
    artist: 'Loyalty Freak Music',
    sourceUrl:
      'https://upload.wikimedia.org/wikipedia/commons/3/35/Loyalty_Freak_Music_-_04_-_Static_Shoes.ogg',
    sourcePage:
      'https://commons.wikimedia.org/wiki/File:Loyalty_Freak_Music_-_04_-_Static_Shoes.ogg',
  },
  {
    title: 'Lag',
    artist: 'Loyalty Freak Music',
    sourceUrl:
      'https://upload.wikimedia.org/wikipedia/commons/c/c3/Loyalty_Freak_Music_-_06_-_Lag.ogg',
    sourcePage: 'https://commons.wikimedia.org/wiki/File:Loyalty_Freak_Music_-_06_-_Lag.ogg',
  },
]

async function ffprobeDurationSec(filePath: string): Promise<number> {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=noprint_wrappers=1:nokey=1',
    filePath,
  ])
  return Math.round(parseFloat(stdout.trim()))
}

async function transcodeToMp3(inputPath: string, outputPath: string): Promise<void> {
  await execFileAsync('ffmpeg', [
    '-y',
    '-i',
    inputPath,
    '-codec:a',
    'libmp3lame',
    '-b:a',
    '192k',
    outputPath,
  ])
}

async function main() {
  const tmpDir = await mkdtemp(path.join(tmpdir(), 'tahti-selects-'))

  try {
    const passwordHash = await hashPassword(randomBytes(32).toString('hex'))
    const streamPass = randomBytes(16).toString('hex')
    const streamKey = `${TAHTI_SELECTS_SLUG}__${randomBytes(8).toString('hex')}`

    const user = await prisma.user.upsert({
      where: { username: TAHTI_SELECTS_SLUG },
      create: {
        email: SYSTEM_EMAIL,
        passwordHash,
        username: TAHTI_SELECTS_SLUG,
        displayName: 'Tahti Selects',
        emailVerifiedAt: new Date(),
        isMember: true,
        channel: {
          create: {
            slug: TAHTI_SELECTS_SLUG,
            state: 'LIVE',
            liveSourceMount: `/live/${TAHTI_SELECTS_SLUG}`,
            liveSourcePass: streamPass,
            liveSourcePassHash: await hashPassword(streamPass),
            rtmpStreamKey: streamKey,
            rtmpStreamKeyHash: await hashPassword(streamKey),
            nextBroadcastNote: 'Curated CC0 rotation — admin-programmed, loops endlessly.',
          },
        },
      },
      update: { displayName: 'Tahti Selects' },
      include: { channel: true },
    })

    const channel =
      user.channel ??
      (await prisma.channel.create({
        data: {
          userId: user.id,
          slug: TAHTI_SELECTS_SLUG,
          state: 'LIVE',
          liveSourceMount: `/live/${TAHTI_SELECTS_SLUG}`,
          liveSourcePass: streamPass,
          liveSourcePassHash: await hashPassword(streamPass),
          rtmpStreamKey: streamKey,
          rtmpStreamKeyHash: await hashPassword(streamKey),
          nextBroadcastNote: 'Curated CC0 rotation — admin-programmed, loops endlessly.',
        },
      }))

    if (channel.state !== 'LIVE') {
      await prisma.channel.update({ where: { id: channel.id }, data: { state: 'LIVE' } })
    }

    // Persistent placeholder broadcast — never ended, lets the existing watchdog
    // and /restart orchestrator route work unmodified (both require a broadcastId).
    let broadcast = await prisma.broadcast.findFirst({
      where: { channelId: channel.id, endedAt: null },
    })
    if (!broadcast) {
      broadcast = await prisma.broadcast.create({
        data: { channelId: channel.id, source: 'ICECAST' },
      })
    }

    let position = 0
    for (const track of TRACKS) {
      const existing = await prisma.archiveItem.findFirst({
        where: { channelId: channel.id, title: track.title },
      })

      let archiveItemId: string
      if (existing) {
        archiveItemId = existing.id
      } else {
        const oggPath = path.join(tmpDir, `${position}.ogg`)
        const mp3Path = path.join(tmpDir, `${position}.mp3`)

        const res = await fetch(track.sourceUrl, {
          headers: { 'User-Agent': 'TahtiSelectsSeed/1.0 (https://tahti.live; contact: ops@tahti.live)' },
        })
        if (!res.ok) {
          throw new Error(`Download failed (${res.status}): ${track.sourceUrl}`)
        }
        await writeFile(oggPath, Buffer.from(await res.arrayBuffer()))
        await transcodeToMp3(oggPath, mp3Path)
        const durationSec = await ffprobeDurationSec(mp3Path)

        const archiveItem = await prisma.archiveItem.create({
          data: {
            channelId: channel.id,
            title: track.title,
            status: 'READY',
            isPublic: true,
            license: 'CC0',
            qualityBadge: 'TRANSCODED',
            durationSec,
            commentary: `CC0 1.0 Universal (Public Domain Dedication) — ${track.artist}. Source: ${track.sourcePage}`,
          },
        })

        const mp3Key = `mp3/${TAHTI_SELECTS_SLUG}/${archiveItem.id}.mp3`
        const mp3Buf = await readFile(mp3Path)
        await s3.send(
          new PutObjectCommand({
            Bucket: config.minio.bucket,
            Key: mp3Key,
            Body: mp3Buf,
            ContentType: 'audio/mpeg',
          }),
        )
        await prisma.archiveItem.update({
          where: { id: archiveItem.id },
          data: { mp3Key, fileSizeBytes: BigInt(mp3Buf.length) },
        })

        archiveItemId = archiveItem.id
      }

      await prisma.curatedRotationItem.upsert({
        where: { channelId_archiveItemId: { channelId: channel.id, archiveItemId } },
        create: { channelId: channel.id, archiveItemId, position, addedById: user.id },
        update: { position },
      })

      position++
    }

    console.log(JSON.stringify({ ok: true, slug: TAHTI_SELECTS_SLUG, tracks: TRACKS.length }))
  } finally {
    await rm(tmpDir, { recursive: true, force: true })
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
