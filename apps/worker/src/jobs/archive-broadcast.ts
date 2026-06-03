// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Job } from 'bullmq'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import ffmpeg from 'fluent-ffmpeg'
import { prisma } from '@tahti/db'
import { isUnlimitedLiveTier } from '@tahti/shared/broadcast-cap'
import { downloadToFile, uploadFile } from '../lib/minio.js'

function ffmpegToMp3(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioFilters('loudnorm=I=-14:TP=-1.5:LRA=11:print_format=none')
      .audioBitrate('192k')
      .format('mp3')
      .on('error', reject)
      .on('end', () => resolve())
      .save(outputPath)
  })
}

function ffmpegToFlac(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioCodec('flac')
      .format('flac')
      .on('error', reject)
      .on('end', () => resolve())
      .save(outputPath)
  })
}

function ffprobeGetDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err)
      resolve(Math.round(metadata.format.duration ?? 0))
    })
  })
}

export async function processArchiveBroadcastJob(job: Job): Promise<void> {
  const { broadcastId } = job.data as { broadcastId: string }

  const broadcast = await prisma.broadcast.findUnique({
    where: { id: broadcastId },
    include: {
      channel: {
        select: {
          id: true,
          slug: true,
          user: { select: { tier: true } },
        },
      },
    },
  })

  if (!broadcast) throw new Error(`Broadcast ${broadcastId} not found`)
  if (!broadcast.recordingKey) {
    console.log(`[worker] broadcast ${broadcastId} has no recording, skipping`)
    return
  }

  const tmpDir = await mkdtemp(join(tmpdir(), 'tahti-broadcast-'))

  try {
    const rawPath = join(tmpDir, 'recording')
    const mp3Path = join(tmpDir, 'output.mp3')

    await downloadToFile(broadcast.recordingKey, rawPath)
    await ffmpegToMp3(rawPath, mp3Path)

    let flacKey: string | null = null
    if (isUnlimitedLiveTier(broadcast.channel.user.tier)) {
      const flacPath = join(tmpDir, 'output.flac')
      await ffmpegToFlac(rawPath, flacPath)
      flacKey = `flac/${broadcast.channel.slug}/broadcast-${broadcastId}.flac`
      await uploadFile(flacKey, flacPath, 'audio/flac')
    }

    const durationSec = await ffprobeGetDuration(mp3Path)
    const mp3Key = `mp3/${broadcast.channel.slug}/broadcast-${broadcastId}.mp3`

    await uploadFile(mp3Key, mp3Path, 'audio/mpeg')

    const startedAt = broadcast.startedAt
    const title = `Live set — ${startedAt.toISOString().slice(0, 10)}`

    const rotationCount = await prisma.archiveItem.count({
      where: { channelId: broadcast.channel.id, isFallback: true },
    })

    const archiveItem = await prisma.archiveItem.create({
      data: {
        channelId: broadcast.channel.id,
        title,
        rawKey: broadcast.recordingKey,
        mp3Key,
        flacKey,
        durationSec,
        fileSizeBytes: 0,
        status: 'READY',
        contentType: 'LIVE',
        genre: 'Electronic',
        license: 'ALL_RIGHTS_RESERVED',
        releasedAt: startedAt,
        isPublic: true,
        isFallback: true,
        fallbackOrder: rotationCount,
        useDetectedBpmKey: true,
        description: `Auto-archived live broadcast from ${startedAt.toISOString()}`,
      },
    })

    await prisma.broadcast.update({
      where: { id: broadcastId },
      data: { archiveItemId: archiveItem.id },
    })
  } catch (err) {
    console.error(`[worker] archive-broadcast ${broadcastId} failed:`, err)
    throw err
  } finally {
    await rm(tmpDir, { recursive: true, force: true })
  }
}
