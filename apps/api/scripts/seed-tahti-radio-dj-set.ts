// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>
/**
 * Ensures one long DJ set is in the Tahti Radio curated rotation.
 *
 * Prefer an existing READY object (e.g. previously uploaded set_20260519),
 * copy it under mp3/tahti-radio/, and append a CuratedRotationItem.
 *
 * Optional local re-upload when the object is missing:
 *   DJ_SET_PATH=/path/to/set.wav tsx apps/api/scripts/seed-tahti-radio-dj-set.ts
 *
 * Run (prod): docker exec -w /app tahti-stack-api-1 tsx apps/api/scripts/seed-tahti-radio-dj-set.ts
 */

import { createReadStream, promises as fs } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { CopyObjectCommand, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { prisma } from '@tahti/db'
import { TAHTI_RADIO_SLUG } from '@tahti/shared'
import { s3 } from '../src/lib/minio.js'
import { config } from '../src/config.js'
import { generateCoverArtSvg } from '../src/lib/generate-cover-art.js'
import { putObjectText } from '../src/lib/minio.js'
import { publicMediaUrl } from '../src/lib/public-media-url.js'

const execFileAsync = promisify(execFile)

const TITLE = 'DJ Set — 2026-05-19'
const ARTIST = 'yaniho'
const SOURCE_KEY_CANDIDATES = [
  'mp3/e2e7lao8l/cms7lasjv000drgp8dy123sbr.mp3',
  'mp3/tahti-radio/set_20260519.mp3',
]
const EXPECTED_DURATION_SEC = 2531

async function objectExists(key: string): Promise<number | null> {
  try {
    const res = await s3.send(new HeadObjectCommand({ Bucket: config.minio.bucket, Key: key }))
    return res.ContentLength ?? 0
  } catch {
    return null
  }
}

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
  const radio = await prisma.channel.findUnique({
    where: { slug: TAHTI_RADIO_SLUG },
    select: { id: true, userId: true },
  })
  if (!radio) throw new Error('Tahti Radio channel not found — run seed-tahti-radio.ts first')

  let archive = await prisma.archiveItem.findFirst({
    where: { channelId: radio.id, title: TITLE },
    select: { id: true, mp3Key: true, durationSec: true },
  })

  if (!archive) {
    archive = await prisma.archiveItem.create({
      data: {
        channelId: radio.id,
        title: TITLE,
        artistName: ARTIST,
        status: 'PROCESSING',
        isPublic: true,
        license: 'ALL_RIGHTS_RESERVED',
        qualityBadge: 'TRANSCODED',
        commentary: 'Long-form DJ set for Tahti Radio rotation (set_20260519).',
      },
      select: { id: true, mp3Key: true, durationSec: true },
    })
  }

  const destKey = `mp3/${TAHTI_RADIO_SLUG}/${archive.id}.mp3`
  let durationSec = archive.durationSec ?? EXPECTED_DURATION_SEC
  let fileSizeBytes: bigint | null = null

  const destSize = await objectExists(destKey)
  if (destSize != null && destSize > 0) {
    fileSizeBytes = BigInt(destSize)
  } else {
    let sourceKey: string | null = null
    for (const key of SOURCE_KEY_CANDIDATES) {
      const size = await objectExists(key)
      if (size != null && size > 0) {
        sourceKey = key
        fileSizeBytes = BigInt(size)
        break
      }
    }

    if (sourceKey) {
      await s3.send(
        new CopyObjectCommand({
          Bucket: config.minio.bucket,
          CopySource: `${config.minio.bucket}/${sourceKey}`,
          Key: destKey,
          ContentType: 'audio/mpeg',
          MetadataDirective: 'REPLACE',
        }),
      )
      const copied = await objectExists(destKey)
      if (copied != null) fileSizeBytes = BigInt(copied)
    } else {
      const localPath = process.env.DJ_SET_PATH
      if (!localPath) {
        throw new Error(
          'No existing MinIO object for the DJ set and DJ_SET_PATH is unset — cannot upload',
        )
      }
      const tmpDir = await mkdtemp(path.join(tmpdir(), 'tahti-dj-set-'))
      try {
        const mp3Path = path.join(tmpDir, 'set.mp3')
        const lower = localPath.toLowerCase()
        if (lower.endsWith('.mp3')) {
          await fs.copyFile(localPath, mp3Path)
        } else {
          await transcodeToMp3(localPath, mp3Path)
        }
        durationSec = await ffprobeDurationSec(mp3Path)
        const stat = await fs.stat(mp3Path)
        fileSizeBytes = BigInt(stat.size)
        await s3.send(
          new PutObjectCommand({
            Bucket: config.minio.bucket,
            Key: destKey,
            Body: createReadStream(mp3Path),
            ContentType: 'audio/mpeg',
            ContentLength: stat.size,
          }),
        )
      } finally {
        await rm(tmpDir, { recursive: true, force: true })
      }
    }
  }

  const coverKey = `archive/${TAHTI_RADIO_SLUG}/${archive.id}/banner-cover.svg`
  await putObjectText(coverKey, generateCoverArtSvg(TITLE, ARTIST), 'image/svg+xml')

  await prisma.archiveItem.update({
    where: { id: archive.id },
    data: {
      status: 'READY',
      mp3Key: destKey,
      durationSec,
      fileSizeBytes: fileSizeBytes ?? undefined,
      bannerUrl: publicMediaUrl(coverKey),
      artistName: ARTIST,
      isPublic: true,
    },
  })

  const last = await prisma.curatedRotationItem.findFirst({
    where: { channelId: radio.id },
    orderBy: { position: 'desc' },
    select: { position: true },
  })
  const position = (last?.position ?? -1) + 1

  const rotation = await prisma.curatedRotationItem.upsert({
    where: {
      channelId_archiveItemId: { channelId: radio.id, archiveItemId: archive.id },
    },
    create: {
      channelId: radio.id,
      archiveItemId: archive.id,
      position,
      addedById: radio.userId,
    },
    update: {},
    select: { id: true, position: true },
  })

  const total = await prisma.curatedRotationItem.count({ where: { channelId: radio.id } })
  console.log(
    JSON.stringify(
      {
        ok: true,
        archiveItemId: archive.id,
        mp3Key: destKey,
        durationSec,
        rotationItemId: rotation.id,
        position: rotation.position,
        rotationTotal: total,
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
