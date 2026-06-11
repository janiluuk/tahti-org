// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Job } from 'bullmq'
import { mkdtemp, rm, stat } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import ffmpeg from 'fluent-ffmpeg'
import { prisma, syncActiveVersionToItem } from '@tahti/db'
import { downloadToFile, uploadFile } from '../lib/minio.js'
import { processTranscodeVersionJob } from './transcode-version.js'

import type { EqBands, LufsTarget } from '@tahti/shared'

export interface BounceArchiveEditPayload {
  versionId: string
  archiveItemId: string
  channelSlug: string
  sourceKey: string
  startSec: number
  endSec: number
  fadeInSec: number
  fadeOutSec: number
  peakNormalize: boolean
  lufsTarget: LufsTarget
  limiterEnabled: boolean
  highPassHz: number
  lowPassHz: number
  eq: EqBands
  compressorEnabled: boolean
  activate: boolean
}

function loudnormFilter(target: Exclude<LufsTarget, 'none'>): string {
  if (target === 'stream') return 'loudnorm=I=-14:TP=-1.5:LRA=11:print_format=none'
  return 'loudnorm=I=-9:TP=-0.5:LRA=7:print_format=none'
}

/** PLAT-066/068: 3-band shelving/peaking EQ — low/high shelves + mid peaking band. */
function eqFilters(eq: EqBands): string[] {
  const filters: string[] = []
  if (eq.lowGainDb !== 0) filters.push(`bass=g=${eq.lowGainDb}:f=200`)
  if (eq.midGainDb !== 0) filters.push(`equalizer=f=1000:width_type=o:width=2:g=${eq.midGainDb}`)
  if (eq.highGainDb !== 0) filters.push(`treble=g=${eq.highGainDb}:f=4000`)
  return filters
}

function buildAudioFilters(
  clipDuration: number,
  fadeInSec: number,
  fadeOutSec: number,
  peakNormalize: boolean,
  lufsTarget: LufsTarget,
  limiterEnabled: boolean,
  highPassHz: number,
  lowPassHz: number,
  eq: EqBands,
  compressorEnabled: boolean,
): string {
  const filters: string[] = []
  // PLAT-066/067: HP/LP filters and EQ/compressor are applied first, before
  // fades/loudness so the dynamics processing sees the shaped signal.
  if (highPassHz > 0) filters.push(`highpass=f=${highPassHz}`)
  if (lowPassHz > 0) filters.push(`lowpass=f=${lowPassHz}`)
  filters.push(...eqFilters(eq))
  if (compressorEnabled) {
    filters.push('acompressor=threshold=-18dB:ratio=3:attack=20:release=250:makeup=2')
  }
  if (fadeInSec > 0) filters.push(`afade=t=in:st=0:d=${fadeInSec}`)
  if (fadeOutSec > 0) {
    const fadeOutStart = Math.max(0, clipDuration - fadeOutSec)
    filters.push(`afade=t=out:st=${fadeOutStart}:d=${fadeOutSec}`)
  }
  if (lufsTarget !== 'none') {
    filters.push(loudnormFilter(lufsTarget))
  } else if (peakNormalize) {
    filters.push('dynaudnorm')
  }
  if (limiterEnabled) filters.push('alimiter=limit=0.98:attack=5:release=50')
  return filters.length > 0 ? filters.join(',') : 'anull'
}

function ffmpegTrimFade(
  inputPath: string,
  outputPath: string,
  startSec: number,
  endSec: number,
  fadeInSec: number,
  fadeOutSec: number,
  peakNormalize: boolean,
  lufsTarget: LufsTarget,
  limiterEnabled: boolean,
  highPassHz: number,
  lowPassHz: number,
  eq: EqBands,
  compressorEnabled: boolean,
): Promise<void> {
  const clipDuration = endSec - startSec
  const filters = buildAudioFilters(
    clipDuration,
    fadeInSec,
    fadeOutSec,
    peakNormalize,
    lufsTarget,
    limiterEnabled,
    highPassHz,
    lowPassHz,
    eq,
    compressorEnabled,
  )

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .setStartTime(startSec)
      .setDuration(clipDuration)
      .audioFilters(filters)
      .format('wav')
      .audioCodec('pcm_s16le')
      .audioFrequency(44100)
      .audioChannels(2)
      .on('error', reject)
      .on('end', () => resolve())
      .save(outputPath)
  })
}

export async function processBounceArchiveEditJob(job: Job): Promise<void> {
  const data = job.data as BounceArchiveEditPayload
  const {
    versionId,
    archiveItemId,
    channelSlug,
    sourceKey,
    startSec,
    endSec,
    fadeInSec,
    fadeOutSec,
    peakNormalize,
    lufsTarget,
    limiterEnabled,
    highPassHz,
    lowPassHz,
    eq,
    compressorEnabled,
    activate,
  } = data

  const version = await prisma.archiveItemVersion.findUnique({ where: { id: versionId } })
  if (!version) throw new Error(`ArchiveItemVersion ${versionId} not found`)

  await prisma.archiveItemVersion.update({
    where: { id: versionId },
    data: { status: 'PROCESSING' },
  })

  const tmpDir = await mkdtemp(join(tmpdir(), 'tahti-bounce-'))
  const rawKey = `raw/${channelSlug}/${randomUUID()}.wav`

  try {
    const inputPath = join(tmpDir, 'input')
    const outputPath = join(tmpDir, 'trimmed.wav')
    await downloadToFile(sourceKey, inputPath)
    await ffmpegTrimFade(
      inputPath,
      outputPath,
      startSec,
      endSec,
      fadeInSec,
      fadeOutSec,
      peakNormalize,
      lufsTarget,
      limiterEnabled,
      highPassHz,
      lowPassHz,
      eq,
      compressorEnabled,
    )

    const fileStat = await stat(outputPath)
    await uploadFile(rawKey, outputPath, 'audio/wav')

    await prisma.archiveItemVersion.update({
      where: { id: versionId },
      data: {
        rawKey,
        fileSizeBytes: BigInt(fileStat.size),
      },
    })

    await processTranscodeVersionJob({ data: { versionId } } as Job)

    if (activate) {
      await prisma.$transaction([
        prisma.archiveItemVersion.updateMany({
          where: { archiveItemId },
          data: { isActive: false },
        }),
        prisma.archiveItemVersion.update({
          where: { id: versionId },
          data: { isActive: true },
        }),
      ])
      await syncActiveVersionToItem(prisma, archiveItemId)
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
