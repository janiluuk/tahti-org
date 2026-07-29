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
}

function trimAndFade(
  inputPath: string,
  outputPath: string,
  startSec: number,
  endSec: number,
  fadeInSec: number,
  fadeOutSec: number,
): Promise<void> {
  const clipDuration = endSec - startSec
  const filters: string[] = []
  if (fadeInSec > 0) filters.push(`afade=t=in:st=0:d=${fadeInSec}`)
  if (fadeOutSec > 0) {
    const fadeOutStart = Math.max(0, clipDuration - fadeOutSec)
    filters.push(`afade=t=out:st=${fadeOutStart}:d=${fadeOutSec}`)
  }

  return new Promise((resolve, reject) => {
    let cmd = ffmpeg(inputPath).setStartTime(startSec).duration(clipDuration)
    if (filters.length > 0) cmd = cmd.audioFilters(filters)
    cmd
      .audioCodec('libmp3lame')
      .audioBitrate('192k')
      .on('error', (err) => reject(err))
      .on('end', () => resolve())
      .save(outputPath)
  })
}

// Always renders from the untouched original upload (payload.sourceKey is
// AnnouncementClip.originalAudioKey) rather than the current audioKey, so
// re-editing never compounds quality loss and the source is always available
// for the editor's "original" A/B preview.
export async function processRenderAnnouncementTrimJob(job: Job): Promise<void> {
  const { clipId, sourceKey, outputKeyPrefix, startSec, endSec, fadeInSec, fadeOutSec } =
    job.data as RenderAnnouncementTrimPayload

  await prisma.announcementClip.update({
    where: { id: clipId },
    data: { renderStatus: 'PROCESSING' },
  })

  const tmpDir = await mkdtemp(join(tmpdir(), 'tahti-announcement-trim-'))
  const outputKey = `${outputKeyPrefix}/${randomUUID()}.mp3`

  try {
    const inputPath = join(tmpDir, 'input')
    const outputPath = join(tmpDir, 'trimmed.mp3')
    await downloadToFile(sourceKey, inputPath)
    await trimAndFade(inputPath, outputPath, startSec, endSec, fadeInSec, fadeOutSec)
    await uploadFile(outputKey, outputPath, 'audio/mpeg')

    await prisma.announcementClip.update({
      where: { id: clipId },
      data: {
        audioKey: outputKey,
        durationSec: Math.round(endSec - startSec),
        renderStatus: 'READY',
      },
    })
  } catch (err) {
    await prisma.announcementClip.update({
      where: { id: clipId },
      data: { renderStatus: 'ERROR' },
    })
    throw err
  } finally {
    await rm(tmpDir, { recursive: true, force: true })
  }
}
