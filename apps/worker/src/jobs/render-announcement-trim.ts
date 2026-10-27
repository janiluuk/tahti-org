// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Job } from 'bullmq'
import { mkdtemp, rm } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import ffmpeg from 'fluent-ffmpeg'
import { prisma } from '@tahti/db'
import { downloadToFile, uploadFile } from '../lib/minio.js'

export interface RenderAnnouncementTrimPayload {
  clipId: string
  sourceKey: string
  outputKeyPrefix: string
  startSec: number
  endSec: number
  fadeInSec: number
  fadeOutSec: number
  editorToken?: string
  normalize?: boolean
  removeRumble?: boolean
  compress?: boolean
  deEss?: boolean
  warmth?: boolean
  clarity?: boolean
}

export function announcementFilters(settings: RenderAnnouncementTrimPayload): string[] {
  const filters: string[] = []
  if (settings.removeRumble) filters.push('highpass=f=80')
  if (settings.warmth) filters.push('equalizer=f=180:t=q:w=0.7:g=2')
  if (settings.clarity) filters.push('equalizer=f=3000:t=q:w=0.8:g=2')
  if (settings.compress)
    filters.push('acompressor=threshold=0.125:ratio=3:attack=10:release=150:makeup=1')
  if (settings.deEss) filters.push('deesser=i=0.4:m=0.5:f=0.5')
  if (settings.normalize) filters.push('loudnorm=I=-14:TP=-1.5:LRA=11')
  if (settings.fadeInSec > 0) filters.push(`afade=t=in:st=0:d=${settings.fadeInSec}`)
  if (settings.fadeOutSec > 0)
    filters.push(
      `afade=t=out:st=${settings.endSec - settings.startSec - settings.fadeOutSec}:d=${settings.fadeOutSec}`,
    )
  return filters
}

export async function renderAnnouncementAudio(
  inputPath: string,
  outputPath: string,
  settings: RenderAnnouncementTrimPayload,
): Promise<number> {
  const metadata = await new Promise<ffmpeg.FfprobeData>((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (error, data) => (error ? reject(error) : resolve(data)))
  })
  const audio = metadata.streams.find((s) => s.codec_type === 'audio')
  const duration = Number(metadata.format.duration)
  const sampleRate = Number(audio?.sample_rate)
  if (
    !audio ||
    !Number.isFinite(duration) ||
    !sampleRate ||
    duration > 600.1 ||
    settings.endSec > duration + 0.05
  ) {
    throw new Error('The selected region is outside a valid audio clip (maximum 10 minutes).')
  }
  if (
    !(settings.endSec > settings.startSec) ||
    settings.startSec < 0 ||
    settings.fadeInSec + settings.fadeOutSec > settings.endSec - settings.startSec
  ) {
    throw new Error('Invalid trim or fade settings')
  }
  await new Promise<void>((resolve, reject) => {
    let command = ffmpeg(inputPath)
      .noVideo()
      .setStartTime(settings.startSec)
      .duration(settings.endSec - settings.startSec)
    const filters = announcementFilters(settings)
    if (filters.length) command = command.audioFilters(filters)
    command
      .audioCodec('pcm_f32le')
      .audioFrequency(sampleRate)
      .format('wav')
      .on('error', reject)
      .on('end', () => resolve())
      .save(outputPath)
  })
  return Math.round(settings.endSec - settings.startSec)
}

export async function processRenderAnnouncementTrimJob(job: Job): Promise<void> {
  const settings = job.data as RenderAnnouncementTrimPayload
  const { clipId, sourceKey, outputKeyPrefix, editorToken } = settings
  const where = { id: clipId, ...(editorToken ? { renderToken: editorToken } : {}) }
  const { count } = await prisma.announcementClip.updateMany({
    where,
    data: editorToken ? { draftStatus: 'PROCESSING' } : { renderStatus: 'PROCESSING' },
  })
  if (!count) return
  const tmpDir = await mkdtemp(join(tmpdir(), 'tahti-announcement-trim-'))
  const outputKey = `${outputKeyPrefix}/${randomUUID()}.wav`
  try {
    const inputPath = join(tmpDir, 'input')
    const outputPath = join(tmpDir, 'processed.wav')
    await downloadToFile(sourceKey, inputPath)
    const durationSec = await renderAnnouncementAudio(inputPath, outputPath, settings)
    await uploadFile(outputKey, outputPath, 'audio/wav')
    await prisma.announcementClip.updateMany({
      where,
      data: editorToken
        ? {
            draftAudioKey: outputKey,
            draftDurationSec: durationSec,
            draftStatus: 'READY',
          }
        : { audioKey: outputKey, durationSec, renderStatus: 'READY' },
    })
  } catch (error) {
    await prisma.announcementClip.updateMany({
      where,
      data: editorToken ? { draftStatus: 'ERROR' } : { renderStatus: 'ERROR' },
    })
    throw error
  } finally {
    await rm(tmpDir, { recursive: true, force: true })
  }
}
