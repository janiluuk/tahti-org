// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Job } from 'bullmq'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import ffmpeg from 'fluent-ffmpeg'
import { prisma } from '@tahti/db'
import { isUnlimitedLiveTier } from '@tahti/shared/broadcast-cap'
import { broadcastSessionLogFields } from '@tahti/shared'
import { downloadToFile, uploadFile } from '../lib/minio.js'
import { enqueueWarmSoundFallbackCache } from '../lib/queue.js'
import {
  clearBroadcastFingerprintSegments,
  fetchBroadcastFingerprintSegments,
} from '../lib/broadcast-fingerprint.js'
import { buildTracklistFromFingerprints } from '../lib/fingerprint-tracklist.js'
import { extractWaveformPeaks } from '../lib/waveform.js'

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

export async function processSoundBroadcastJob(job: Job): Promise<void> {
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
  const base = broadcastSessionLogFields({
    broadcastId,
    channelId: broadcast.channel.id,
    slug: broadcast.channel.slug,
    source: broadcast.source,
  })

  if (!broadcast.recordingKey) {
    console.log(
      JSON.stringify({
        ...base,
        msg: 'no recordingKey, skipping sound',
        component: 'sound-broadcast',
      }),
    )
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
    const peaks = (await extractWaveformPeaks(rawPath)) ?? undefined
    const mp3Key = `mp3/${broadcast.channel.slug}/broadcast-${broadcastId}.mp3`

    await uploadFile(mp3Key, mp3Path, 'audio/mpeg')

    const startedAt = broadcast.startedAt
    const showType = broadcast.showType ?? 'LIVE_SET'
    const title =
      broadcast.title ??
      (showType === 'TALK'
        ? `Talk — ${startedAt.toISOString().slice(0, 10)}`
        : `Live set — ${startedAt.toISOString().slice(0, 10)}`)
    const contentType = showType === 'TALK' ? 'PODCAST' : 'LIVE'
    const scheduledDescription = (broadcast as typeof broadcast & { description?: string | null })
      .description
    const scheduledArtworkUrl = (broadcast as typeof broadcast & { artworkUrl?: string | null })
      .artworkUrl

    const rotationCount = await prisma.sound.count({
      where: { channelId: broadcast.channel.id, isFallback: true },
    })

    let tracklist: Awaited<ReturnType<typeof buildTracklistFromFingerprints>> | undefined
    try {
      const fpSegments = await fetchBroadcastFingerprintSegments(broadcastId)
      const hints = await buildTracklistFromFingerprints(fpSegments)
      if (hints.length > 0) tracklist = hints
      await clearBroadcastFingerprintSegments(broadcastId)
    } catch (err) {
      console.warn(
        JSON.stringify({
          ...base,
          msg: 'fingerprint tracklist merge skipped',
          err: String(err),
          component: 'sound-broadcast',
        }),
      )
    }

    const sound = await prisma.sound.create({
      data: {
        channelId: broadcast.channel.id,
        title,
        rawKey: broadcast.recordingKey,
        mp3Key,
        flacKey,
        durationSec,
        peaks,
        fileSizeBytes: 0,
        status: 'READY',
        contentType,
        genre: showType === 'TALK' ? 'Talk' : 'Electronic',
        license: 'ALL_RIGHTS_RESERVED',
        releasedAt: startedAt,
        // Broadcasting Setup step 3 "auto-sound" toggle: off means the recording is
        // saved as a draft for the artist to polish & publish manually (sound-editor.tsx).
        isPublic: broadcast.autoPublish,
        isFallback: true,
        fallbackOrder: rotationCount,
        useDetectedBpmKey: true,
        description:
          scheduledDescription ??
          (showType === 'TALK'
            ? `Auto-soundd talk show from ${startedAt.toISOString()}`
            : `Auto-soundd live broadcast from ${startedAt.toISOString()}`),
        bannerUrl: scheduledArtworkUrl,
        ...(tracklist ? { tracklist } : {}),
      },
    })

    await prisma.broadcast.update({
      where: { id: broadcastId },
      data: { soundId: sound.id },
    })
    console.log(
      JSON.stringify({
        ...base,
        soundId: sound.id,
        msg: 'broadcast soundd',
        component: 'sound-broadcast',
      }),
    )
    await enqueueWarmSoundFallbackCache(broadcast.channel.id)
  } catch (err) {
    console.error(
      JSON.stringify({
        ...base,
        err: String(err),
        msg: 'sound failed',
        component: 'sound-broadcast',
      }),
    )
    throw err
  } finally {
    await rm(tmpDir, { recursive: true, force: true })
  }
}
