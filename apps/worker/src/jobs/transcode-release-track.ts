// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import type { Job } from 'bullmq'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, extname } from 'node:path'
import ffmpeg from 'fluent-ffmpeg'
import { prisma } from '@tahti/db'
import { downloadToFile, uploadFile } from '../lib/minio.js'

function ffprobeMetadata(
  filePath: string,
): Promise<{ duration: number; sampleRate: number; bitDepth: number; format: string }> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err)
      const stream = metadata.streams.find((s) => s.codec_type === 'audio')
      const fmt = (metadata.format.format_name ?? '').split(',')[0]
      resolve({
        duration: Math.round(metadata.format.duration ?? 0),
        sampleRate: stream?.sample_rate ? parseInt(String(stream.sample_rate), 10) : 44100,
        bitDepth: Number(stream?.bits_per_raw_sample ?? stream?.bits_per_sample ?? 16),
        format: fmt,
      })
    })
  })
}

function transcodeOpus(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioCodec('libopus')
      .audioBitrate('256k')
      .format('ogg')
      .on('error', reject)
      .on('end', () => resolve())
      .save(outputPath)
  })
}

function transcodeFlac(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioCodec('flac')
      .audioFrequency(44100)
      .audioChannels(2)
      // Downsample 24-bit to 16-bit with proper dither
      .outputOptions(['-sample_fmt', 's16', '-af', 'aresample=resampler=soxr:precision=28'])
      .format('flac')
      .on('error', reject)
      .on('end', () => resolve())
      .save(outputPath)
  })
}

export async function processTranscodeReleaseTrackJob(job: Job): Promise<void> {
  const { trackId } = job.data as { trackId: string }

  const track = await prisma.releaseTrack.findUnique({
    where: { id: trackId },
    include: { release: { select: { userId: true } } },
  })

  if (!track) throw new Error(`ReleaseTrack ${trackId} not found`)
  if (!track.sourceKey) throw new Error(`ReleaseTrack ${trackId} has no sourceKey`)

  const tmpDir = await mkdtemp(join(tmpdir(), 'tahti-rtranscode-'))

  try {
    await prisma.releaseTrack.update({
      where: { id: trackId },
      data: { status: 'SCANNING' },
    })

    const ext = extname(track.sourceKey).slice(1) || 'bin'
    const srcPath = join(tmpDir, `source.${ext}`)
    await downloadToFile(track.sourceKey, srcPath)

    const meta = await ffprobeMetadata(srcPath)

    if (meta.duration < 1) throw new Error('Audio too short (< 1 second)')
    if (meta.duration > 8 * 3600) throw new Error('Audio too long (> 8 hours)')

    await prisma.releaseTrack.update({
      where: { id: trackId },
      data: {
        status: 'TRANSCODING',
        durationSec: meta.duration,
        sourceSampleRate: meta.sampleRate,
        sourceBitDepth: meta.bitDepth,
        sourceFormat: meta.format,
      },
    })

    const base = `releases/${track.release.userId}/${track.releaseId}/${trackId}`
    const opusPath = join(tmpDir, 'stream.ogg')
    const streamKey = `${base}/stream.ogg`

    await transcodeOpus(srcPath, opusPath)
    await uploadFile(streamKey, opusPath, 'audio/ogg')

    let flacKey: string | undefined
    // Produce FLAC derivative when source is lossless (wav/flac/aiff) or high-res
    const losslessFormats = ['wav', 'flac', 'aiff', 'pcm_s16le', 'pcm_s24le', 'pcm_s32le']
    if (losslessFormats.some((f) => meta.format.includes(f)) || meta.bitDepth >= 16) {
      const flacPath = join(tmpDir, 'download.flac')
      flacKey = `${base}/download.flac`
      await transcodeFlac(srcPath, flacPath)
      await uploadFile(flacKey, flacPath, 'audio/flac')
    }

    await prisma.releaseTrack.update({
      where: { id: trackId },
      data: {
        streamKey,
        flacKey: flacKey ?? null,
        status: 'READY',
      },
    })
  } catch (err) {
    await prisma.releaseTrack.update({
      where: { id: trackId },
      data: { status: 'FAILED' },
    })
    throw err
  } finally {
    await rm(tmpDir, { recursive: true, force: true })
  }
}
