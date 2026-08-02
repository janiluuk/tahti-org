// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>
/**
 * Seeds CC0 atmospheric tracks (John Bartmann / Wikimedia Commons) as FLAC+MP3
 * into Tahti Radio's curated rotation, and attaches copies to a handful of
 * @beta.tahti.live artists' archives (isFallback) for Discover replay variety.
 *
 * Expects a prepared directory (download + ffmpeg convert done locally — the
 * API image has no ffmpeg):
 *
 *   AMBIENT_DIR=/tmp/tahti-ambient \
 *     tsx apps/api/scripts/seed-atmospheric-cc0.ts
 *
 * Directory must contain manifest.json + *.flac / *.mp3 named by slug.
 */

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { prisma } from '@tahti/db'
import { TAHTI_RADIO_SLUG } from '@tahti/shared'
import { s3, putObjectText } from '../src/lib/minio.js'
import { config } from '../src/config.js'
import { generateCoverArtSvg } from '../src/lib/generate-cover-art.js'
import { publicMediaUrl } from '../src/lib/public-media-url.js'

interface ManifestTrack {
  title: string
  artist: string
  sourcePage: string
  slug: string
  durationSec: number
  flacFile: string
  mp3File: string
}

const ARTISTS_TO_SEED = 8

async function main() {
  const dir = process.env.AMBIENT_DIR
  if (!dir) throw new Error('Set AMBIENT_DIR to the prepared track directory')

  const manifest = JSON.parse(await readFile(path.join(dir, 'manifest.json'), 'utf8')) as ManifestTrack[]
  if (manifest.length === 0) throw new Error('manifest.json is empty')

  const radio = await prisma.channel.findUnique({
    where: { slug: TAHTI_RADIO_SLUG },
    select: { id: true, userId: true },
  })
  if (!radio) throw new Error('Tahti Radio channel not found')

  const betaChannels = await prisma.channel.findMany({
    where: { user: { email: { endsWith: '@beta.tahti.live' } } },
    select: { id: true, slug: true },
    orderBy: { slug: 'asc' },
    take: ARTISTS_TO_SEED,
  })

  const radioResults: Array<{ title: string; archiveItemId: string; position: number }> = []
  const artistResults: Array<{ slug: string; title: string }> = []

  let lastPos =
    (
      await prisma.curatedRotationItem.findFirst({
        where: { channelId: radio.id },
        orderBy: { position: 'desc' },
        select: { position: true },
      })
    )?.position ?? -1

  for (let i = 0; i < manifest.length; i++) {
    const track = manifest[i]!
    const flacBuf = await readFile(path.join(dir, track.flacFile))
    const mp3Buf = await readFile(path.join(dir, track.mp3File))

    let archive = await prisma.archiveItem.findFirst({
      where: { channelId: radio.id, title: track.title, artistName: track.artist },
      select: { id: true, mp3Key: true, flacKey: true },
    })
    if (!archive) {
      archive = await prisma.archiveItem.create({
        data: {
          channelId: radio.id,
          title: track.title,
          artistName: track.artist,
          status: 'PROCESSING',
          isPublic: true,
          license: 'CC0',
          qualityBadge: 'LOSSLESS',
          commentary: `CC0 1.0 Universal (Public Domain Dedication) — ${track.artist}. Source: ${track.sourcePage}`,
        },
        select: { id: true, mp3Key: true, flacKey: true },
      })
    }

    const mp3Key = `mp3/${TAHTI_RADIO_SLUG}/${archive.id}.mp3`
    const flacKey = `flac/${TAHTI_RADIO_SLUG}/${archive.id}.flac`
    const coverKey = `archive/${TAHTI_RADIO_SLUG}/${archive.id}/banner-cover.svg`

    await s3.send(
      new PutObjectCommand({
        Bucket: config.minio.bucket,
        Key: mp3Key,
        Body: mp3Buf,
        ContentType: 'audio/mpeg',
      }),
    )
    await s3.send(
      new PutObjectCommand({
        Bucket: config.minio.bucket,
        Key: flacKey,
        Body: flacBuf,
        ContentType: 'audio/flac',
      }),
    )
    await putObjectText(coverKey, generateCoverArtSvg(track.title, track.artist), 'image/svg+xml')

    await prisma.archiveItem.update({
      where: { id: archive.id },
      data: {
        status: 'READY',
        mp3Key,
        flacKey,
        durationSec: track.durationSec,
        fileSizeBytes: BigInt(flacBuf.length),
        sourceFormat: 'FLAC',
        bannerUrl: publicMediaUrl(coverKey),
        license: 'CC0',
        qualityBadge: 'LOSSLESS',
        commentary: `CC0 1.0 Universal (Public Domain Dedication) — ${track.artist}. Source: ${track.sourcePage}`,
      },
    })

    lastPos += 1
    const rotation = await prisma.curatedRotationItem.upsert({
      where: {
        channelId_archiveItemId: { channelId: radio.id, archiveItemId: archive.id },
      },
      create: {
        channelId: radio.id,
        archiveItemId: archive.id,
        position: lastPos,
        addedById: radio.userId,
      },
      update: {},
      select: { position: true },
    })
    radioResults.push({
      title: track.title,
      archiveItemId: archive.id,
      position: rotation.position,
    })

    // Attach the same MinIO objects to one beta artist (round-robin) so their
    // replay radio has atmospheric lossless material without re-uploading.
    const artist = betaChannels[i % Math.max(betaChannels.length, 1)]
    if (artist) {
      const existing = await prisma.archiveItem.findFirst({
        where: { channelId: artist.id, title: track.title, artistName: track.artist },
        select: { id: true },
      })
      if (!existing) {
        const fallbackCount = await prisma.archiveItem.count({
          where: { channelId: artist.id, isFallback: true },
        })
        await prisma.archiveItem.create({
          data: {
            channelId: artist.id,
            title: track.title,
            artistName: track.artist,
            status: 'READY',
            isPublic: true,
            isFallback: fallbackCount < 5,
            fallbackOrder: fallbackCount,
            license: 'CC0',
            qualityBadge: 'LOSSLESS',
            mp3Key,
            flacKey,
            durationSec: track.durationSec,
            fileSizeBytes: BigInt(flacBuf.length),
            sourceFormat: 'FLAC',
            bannerUrl: publicMediaUrl(coverKey),
            commentary: `CC0 atmospheric demo for replay radio — ${track.artist}. Source: ${track.sourcePage}`,
          },
        })
        artistResults.push({ slug: artist.slug, title: track.title })
      } else {
        artistResults.push({ slug: artist.slug, title: `${track.title} (already present)` })
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        tracks: manifest.length,
        radioAdded: radioResults,
        artistsSeeded: artistResults,
        rotationTotal: await prisma.curatedRotationItem.count({ where: { channelId: radio.id } }),
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
