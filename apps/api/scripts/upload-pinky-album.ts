// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>
/**
 * One-off admin upload of the "Pinky" 8-track set to the yaniho channel's
 * archive. Source mp3s are pre-cut locally (silence-split pink.mkv, with the
 * exact duplicate middle section removed) and rsynced to PINKY_DIR on this
 * host before running.
 *
 * Run (prod): docker exec -w /app tahti-stack-api-1 tsx apps/api/scripts/upload-pinky-album.ts
 */

import { createReadStream, promises as fs } from 'node:fs'
import path from 'node:path'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { prisma } from '@tahti/db'
import { s3 } from '../src/lib/minio.js'
import { config } from '../src/config.js'
import { generateCoverArtSvg } from '../src/lib/generate-cover-art.js'
import { putObjectText } from '../src/lib/minio.js'
import { publicMediaUrl } from '../src/lib/public-media-url.js'

const CHANNEL_SLUG = 'yaniho'
const PINKY_DIR = process.env.PINKY_DIR ?? '/tmp/pinky-upload'

// Measured locally with ffprobe before upload (this container has no ffprobe binary).
const DURATIONS_SEC: Record<number, number> = {
  1: 1926,
  2: 1927,
  3: 1926,
  4: 1926,
  5: 1926,
  6: 1927,
  7: 1926,
  8: 1926,
}
const TRACK_COUNT = 8

async function main() {
  const channel = await prisma.channel.findUnique({
    where: { slug: CHANNEL_SLUG },
    select: { id: true, userId: true },
  })
  if (!channel) throw new Error(`No channel with slug "${CHANNEL_SLUG}"`)

  const coverKey = `archive/${CHANNEL_SLUG}/pinky/cover.svg`
  await putObjectText(coverKey, generateCoverArtSvg('Pinky', CHANNEL_SLUG), 'image/svg+xml')
  const coverUrl = publicMediaUrl(coverKey)

  const results: Array<{ n: number; archiveItemId: string; durationSec: number }> = []

  for (let n = 1; n <= TRACK_COUNT; n++) {
    const file = path.join(PINKY_DIR, `pinky-0${n}.mp3`)
    const stat = await fs.stat(file)
    const durationSec = DURATIONS_SEC[n]!
    const destKey = `mp3/${CHANNEL_SLUG}/pinky/pinky-0${n}.mp3`

    await s3.send(
      new PutObjectCommand({
        Bucket: config.minio.bucket,
        Key: destKey,
        Body: createReadStream(file),
        ContentType: 'audio/mpeg',
        ContentLength: stat.size,
      }),
    )

    const title = `Pinky — Part ${n}`
    let archive = await prisma.archiveItem.findFirst({
      where: { channelId: channel.id, title },
      select: { id: true },
    })

    if (archive) {
      await prisma.archiveItem.update({
        where: { id: archive.id },
        data: {
          status: 'READY',
          mp3Key: destKey,
          durationSec,
          fileSizeBytes: BigInt(stat.size),
          bannerUrl: coverUrl,
          isPublic: true,
        },
      })
    } else {
      archive = await prisma.archiveItem.create({
        data: {
          channelId: channel.id,
          title,
          status: 'READY',
          isPublic: true,
          license: 'ALL_RIGHTS_RESERVED',
          qualityBadge: 'TRANSCODED',
          commentary: `Part ${n} of 8 — Pinky.`,
          mp3Key: destKey,
          durationSec,
          fileSizeBytes: BigInt(stat.size),
          bannerUrl: coverUrl,
          trackOrder: n,
        },
        select: { id: true },
      })
    }

    results.push({ n, archiveItemId: archive.id, durationSec })
    console.log(`uploaded track ${n}: ${archive.id} (${durationSec}s)`)
  }

  console.log(JSON.stringify({ ok: true, channelSlug: CHANNEL_SLUG, coverUrl, results }, null, 2))
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
