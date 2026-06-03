// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import type { Job } from 'bullmq'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import ffmpeg from 'fluent-ffmpeg'
import { prisma } from '@tahti/db'
import { isLosslessSource, mergeDetectedArchiveMetadata, parseArchiveFileTags } from '@tahti/shared'
import { downloadToFile, uploadFile } from '../lib/minio.js'

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

/** Read embedded ID3/Vorbis tags from format + audio stream. */
function ffprobeEmbeddedTags(filePath: string): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err)
      const stream = metadata.streams.find((s) => s.codec_type === 'audio')
      resolve({
        ...(metadata.format.tags ?? {}),
        ...(stream?.tags ?? {}),
      })
    })
  })
}

function tagFieldsFromFile(
  item: {
    description: string | null
    genre: string | null
    genreCustom: string | null
    recordingLocation: string | null
    mixVersion: string | null
    useDetectedBpmKey: boolean
  },
  tags: Record<string, unknown>,
): Record<string, unknown> {
  const parsed = parseArchiveFileTags(tags)
  const patch: Record<string, unknown> = {
    ...mergeDetectedArchiveMetadata(item, parsed),
  }
  if (parsed.bpm != null) patch.bpmDetected = parsed.bpm
  if (parsed.key != null) patch.keyDetected = parsed.key
  return patch
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
    await downloadToFile(item.rawKey, rawPath)

    const sourceMeta = await ffprobeFormat(rawPath)
    const embeddedTags = await ffprobeEmbeddedTags(rawPath).catch(() => ({}))
    const tagPatch = tagFieldsFromFile(item, embeddedTags)
    const lossless = isLosslessSource(sourceMeta.format)

    if (lossless) {
      const flacPath = join(tmpDir, 'output.flac')
      await ffmpegToFlac(rawPath, flacPath)
      const flacKey = `flac/${item.channel.slug}/${itemId}.flac`
      await uploadFile(flacKey, flacPath, 'audio/flac')

      await prisma.archiveItem.update({
        where: { id: itemId },
        data: {
          status: 'READY',
          flacKey,
          mp3Key: null,
          durationSec: sourceMeta.duration,
          ...tagPatch,
        },
      })
      return
    }

    const mp3Path = join(tmpDir, 'output.mp3')
    await ffmpegToMp3(rawPath, mp3Path)
    const mp3Key = `mp3/${item.channel.slug}/${itemId}.mp3`
    await uploadFile(mp3Key, mp3Path, 'audio/mpeg')

    await prisma.archiveItem.update({
      where: { id: itemId },
      data: {
        status: 'READY',
        mp3Key,
        durationSec: sourceMeta.duration,
        ...tagPatch,
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
