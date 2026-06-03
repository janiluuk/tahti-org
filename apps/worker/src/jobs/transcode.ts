// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import type { Job } from 'bullmq'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import ffmpeg from 'fluent-ffmpeg'
import { prisma } from '@tahti/db'
import { downloadToFile, uploadFile } from '../lib/minio.js'

function ffmpegNormalize(inputPath: string, outputPath: string): Promise<void> {
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

function ffprobeGetDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err)
      resolve(Math.round(metadata.format.duration ?? 0))
    })
  })
}

/** Read BPM from embedded tags (TBPM / bpm) when present. */
function ffprobeEmbeddedBpm(filePath: string): Promise<number | null> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err)
      const tags = metadata.format.tags ?? {}
      const raw = tags.TBPM ?? tags.bpm ?? tags.BPM
      if (raw == null) {
        resolve(null)
        return
      }
      const n = parseInt(String(raw), 10)
      resolve(n >= 40 && n <= 300 ? n : null)
    })
  })
}

export async function processTranscodeJob(job: Job): Promise<void> {
  const { itemId } = job.data as { itemId: string }

  const item = await prisma.archiveItem.findUnique({
    where: { id: itemId },
    include: { channel: { select: { slug: true } } },
  })

  if (!item) throw new Error(`ArchiveItem ${itemId} not found`)

  await prisma.archiveItem.update({
    where: { id: itemId },
    data: { status: 'PROCESSING' },
  })

  const tmpDir = await mkdtemp(join(tmpdir(), 'tahti-transcode-'))

  try {
    const rawPath = join(tmpDir, 'raw_input')
    const mp3Path = join(tmpDir, 'output.mp3')

    await downloadToFile(item.rawKey, rawPath)
    await ffmpegNormalize(rawPath, mp3Path)

    const durationSec = await ffprobeGetDuration(mp3Path)
    const bpmDetected = await ffprobeEmbeddedBpm(mp3Path).catch(() => null)
    const mp3Key = `mp3/${item.channel.slug}/${itemId}.mp3`

    await uploadFile(mp3Key, mp3Path, 'audio/mpeg')

    await prisma.archiveItem.update({
      where: { id: itemId },
      data: {
        status: 'READY',
        mp3Key,
        durationSec,
        ...(bpmDetected != null ? { bpmDetected } : {}),
      },
    })
  } catch (err) {
    await prisma.archiveItem.update({
      where: { id: itemId },
      data: { status: 'ERROR' },
    })
    throw err
  } finally {
    await rm(tmpDir, { recursive: true, force: true })
  }
}
