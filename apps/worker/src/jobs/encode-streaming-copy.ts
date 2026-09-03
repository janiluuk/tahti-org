// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Job } from 'bullmq'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import ffmpeg from 'fluent-ffmpeg'
import { prisma, notifyArtistStreamingCopyReady } from '@tahti/db'
import { downloadSourceCached } from '../lib/source-cache.js'
import { uploadFile } from '../lib/minio.js'

function logLine(fields: Record<string, unknown>, msg: string): void {
  console.log(JSON.stringify({ ...fields, msg, component: 'encode-streaming-copy' }))
}

// A fixed, conservative bitrate rather than chooseLossyOutputBitrateKbps —
// that helper caps against a *lossy* source's own bitrate, which doesn't
// apply here (the source is lossless). 160kbps is comfortably transparent
// for streaming and meaningfully smaller than the FLAC for slow links.
const STREAMING_COPY_BITRATE_KBPS = 160

function ffmpegToMp3(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioFilters('loudnorm=I=-14:TP=-1.5:LRA=11:print_format=none')
      .audioBitrate(`${STREAMING_COPY_BITRATE_KBPS}k`)
      .format('mp3')
      .on('error', reject)
      .on('end', () => resolve())
      .save(outputPath)
  })
}

export async function processEncodeStreamingCopyJob(job: Job): Promise<void> {
  const { itemId } = job.data as { itemId: string }
  const startedAt = Date.now()

  const item = await prisma.sound.findUnique({
    where: { id: itemId },
    include: { channel: { select: { slug: true, userId: true } } },
  })
  if (!item) throw new Error(`Sound ${itemId} not found`)
  if (!item.rawKey) throw new Error(`Sound ${itemId} has no rawKey`)

  await prisma.sound.update({
    where: { id: itemId },
    data: { streamingCopyStatus: 'PROCESSING' },
  })
  await job.updateProgress(0)
  logLine({ itemId }, `streaming copy starting for ${itemId}`)

  const tmpDir = await mkdtemp(join(tmpdir(), 'tahti-streaming-copy-'))
  try {
    const rawPath = join(tmpDir, 'raw_input')
    await downloadSourceCached(item.rawKey, rawPath)
    await job.updateProgress(25)

    const mp3Path = join(tmpDir, 'output.mp3')
    await ffmpegToMp3(rawPath, mp3Path)
    await job.updateProgress(75)

    const mp3Key = `mp3/${item.channel.slug}/${itemId}.mp3`
    await uploadFile(mp3Key, mp3Path, 'audio/mpeg')
    await job.updateProgress(95)

    await prisma.sound.update({
      where: { id: itemId },
      data: { mp3Key, streamingCopyStatus: 'READY' },
    })
    await notifyArtistStreamingCopyReady(prisma, item.channel.userId, {
      id: itemId,
      title: item.title,
    })
    await job.updateProgress(100)

    logLine(
      { itemId, elapsedMs: Date.now() - startedAt },
      `streaming copy done for ${itemId} in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`,
    )
  } catch (err) {
    await prisma.sound.update({
      where: { id: itemId },
      data: { streamingCopyStatus: 'ERROR' },
    })
    logLine(
      {
        itemId,
        elapsedMs: Date.now() - startedAt,
        error: err instanceof Error ? err.message : String(err),
      },
      `streaming copy failed for ${itemId} after ${((Date.now() - startedAt) / 1000).toFixed(1)}s`,
    )
    throw err
  } finally {
    await rm(tmpDir, { recursive: true, force: true })
  }
}
