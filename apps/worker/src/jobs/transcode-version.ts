// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Job } from 'bullmq'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import ffmpeg from 'fluent-ffmpeg'
import { prisma, syncActiveVersionToItem } from '@tahti/db'
import { isLosslessSource } from '@tahti/shared'
import { downloadToFile, uploadFile } from '../lib/minio.js'
import { extractWaveformPeaks } from '../lib/waveform.js'

function ffprobeFormat(filePath: string): Promise<{ duration: number; format: string }> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err)
      const fmt = (metadata.format.format_name ?? '').split(',')[0]
      resolve({
        duration: Math.round(metadata.format.duration ?? 0),
        format: fmt,
      })
    })
  })
}

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
      .audioFrequency(44100)
      .audioChannels(2)
      .audioFilters('loudnorm=I=-14:TP=-1.5:LRA=11:print_format=none')
      .outputOptions(['-sample_fmt', 's16', '-af', 'aresample=resampler=soxr:precision=28'])
      .format('flac')
      .on('error', reject)
      .on('end', () => resolve())
      .save(outputPath)
  })
}

export async function processTranscodeVersionJob(job: Job): Promise<void> {
  const { versionId } = job.data as { versionId: string }

  const version = await prisma.archiveItemVersion.findUnique({
    where: { id: versionId },
    include: {
      archiveItem: { include: { channel: { select: { slug: true } } } },
    },
  })

  if (!version) throw new Error(`ArchiveItemVersion ${versionId} not found`)

  await prisma.archiveItemVersion.update({
    where: { id: versionId },
    data: { status: 'PROCESSING' },
  })

  const tmpDir = await mkdtemp(join(tmpdir(), 'tahti-vtranscode-'))
  const itemId = version.archiveItemId
  const slug = version.archiveItem.channel.slug

  try {
    const rawPath = join(tmpDir, 'raw_input')
    await downloadToFile(version.rawKey, rawPath)

    const sourceMeta = await ffprobeFormat(rawPath)
    const lossless = isLosslessSource(sourceMeta.format)
    const peaks = (await extractWaveformPeaks(rawPath)) ?? undefined

    if (lossless) {
      const flacPath = join(tmpDir, 'output.flac')
      await ffmpegToFlac(rawPath, flacPath)
      const flacKey = `flac/${slug}/${itemId}-v${version.versionNumber}.flac`
      await uploadFile(flacKey, flacPath, 'audio/flac')

      await prisma.archiveItemVersion.update({
        where: { id: versionId },
        data: {
          status: 'READY',
          flacKey,
          mp3Key: null,
          durationSec: sourceMeta.duration,
          peaks,
        },
      })
    } else {
      const mp3Path = join(tmpDir, 'output.mp3')
      await ffmpegToMp3(rawPath, mp3Path)
      const mp3Key = `mp3/${slug}/${itemId}-v${version.versionNumber}.mp3`
      await uploadFile(mp3Key, mp3Path, 'audio/mpeg')

      await prisma.archiveItemVersion.update({
        where: { id: versionId },
        data: {
          status: 'READY',
          mp3Key,
          durationSec: sourceMeta.duration,
          peaks,
        },
      })
    }

    if (version.isActive) {
      await syncActiveVersionToItem(prisma, itemId)
    }
  } catch (err) {
    await prisma.archiveItemVersion.update({
      where: { id: versionId },
      data: { status: 'ERROR' },
    })
    throw err
  } finally {
    await rm(tmpDir, { recursive: true, force: true })
  }
}
