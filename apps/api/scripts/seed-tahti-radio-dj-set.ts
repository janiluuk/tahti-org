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
import {
  TAHTI_RADIO_SLUG,
  chooseLossyOutputBitrateKbps,
  deriveQualityBadge,
  isLosslessCodec,
  isLosslessSource,
} from '@tahti/shared'
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

async function ffprobeFormat(
  filePath: string,
): Promise<{ format: string; codec: string | null; bitrateKbps: number | null }> {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v',
    'error',
    '-print_format',
    'json',
    '-show_format',
    '-show_streams',
    filePath,
  ])
  const data = JSON.parse(stdout) as {
    format?: { format_name?: string; bit_rate?: string }
    streams?: { codec_type?: string; codec_name?: string; bit_rate?: string }[]
  }
  const format = (data.format?.format_name ?? '').split(',')[0] ?? ''
  const stream = data.streams?.find((s) => s.codec_type === 'audio')
  const rawBitrate = stream?.bit_rate ?? data.format?.bit_rate
  const bitrateKbps = rawBitrate ? Math.round(Number(rawBitrate) / 1000) : null
  return { format, codec: stream?.codec_name ?? null, bitrateKbps }
}

/** Lossless sources (e.g. WAV) are kept as FLAC — never force-encoded down to lossy MP3. */
async function transcodeToFlac(inputPath: string, outputPath: string): Promise<void> {
  await execFileAsync('ffmpeg', [
    '-y',
    '-i',
    inputPath,
    '-codec:a',
    'flac',
    '-ar',
    '44100',
    '-ac',
    '2',
    '-sample_fmt',
    's16',
    '-af',
    'aresample=resampler=soxr:precision=28',
    outputPath,
  ])
}

async function transcodeToMp3(
  inputPath: string,
  outputPath: string,
  bitrateKbps: number,
): Promise<void> {
  await execFileAsync('ffmpeg', [
    '-y',
    '-i',
    inputPath,
    '-codec:a',
    'libmp3lame',
    '-b:a',
    `${bitrateKbps}k`,
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
    select: { id: true, mp3Key: true, flacKey: true, durationSec: true },
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
      select: { id: true, mp3Key: true, flacKey: true, durationSec: true },
    })
  }

  // Prefer whichever key the DB already has (a prior run may have stored
  // FLAC) so a re-run doesn't fall through to the MP3 fallback path and
  // silently downgrade + orphan an existing lossless upload.
  let destKey = archive.flacKey ?? archive.mp3Key ?? `mp3/${TAHTI_RADIO_SLUG}/${archive.id}.mp3`
  let isFlac = Boolean(archive.flacKey)
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
        const lower = localPath.toLowerCase()
        const probe = await ffprobeFormat(localPath)
        const lossless = isLosslessSource(probe.format) || isLosslessCodec(probe.codec)

        let outPath: string
        let contentType: string
        if (lower.endsWith('.mp3') && !lossless) {
          outPath = path.join(tmpDir, 'set.mp3')
          await fs.copyFile(localPath, outPath)
          contentType = 'audio/mpeg'
        } else if (lossless) {
          // Keep lossless sources (e.g. WAV) as FLAC — never force-downsample to MP3.
          outPath = path.join(tmpDir, 'set.flac')
          await transcodeToFlac(localPath, outPath)
          isFlac = true
          destKey = `flac/${TAHTI_RADIO_SLUG}/${archive.id}.flac`
          contentType = 'audio/flac'
        } else {
          outPath = path.join(tmpDir, 'set.mp3')
          const bitrateKbps = chooseLossyOutputBitrateKbps(probe.bitrateKbps)
          await transcodeToMp3(localPath, outPath, bitrateKbps)
          contentType = 'audio/mpeg'
        }

        durationSec = await ffprobeDurationSec(outPath)
        const stat = await fs.stat(outPath)
        fileSizeBytes = BigInt(stat.size)
        await s3.send(
          new PutObjectCommand({
            Bucket: config.minio.bucket,
            Key: destKey,
            Body: createReadStream(outPath),
            ContentType: contentType,
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
      mp3Key: isFlac ? null : destKey,
      flacKey: isFlac ? destKey : null,
      qualityBadge: deriveQualityBadge('UPLOAD', isFlac),
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
        ...(isFlac ? { flacKey: destKey } : { mp3Key: destKey }),
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
