// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Job } from 'bullmq'
import { randomBytes } from 'node:crypto'
import { Readable } from 'node:stream'
import { prisma } from '@tahti/db'
import { extensionFromDriveFile } from '@tahti/shared'
import { decryptStreamKey } from '../lib/stream-key-enc.js'
import { uploadStream } from '../lib/minio.js'
import { enqueueTranscodeArchive } from '../lib/queue.js'

interface SoundcloudTrack {
  id: number
  title: string
  download_url?: string
  downloadable?: boolean
}

export async function processSoundcloudImportJob(job: Job): Promise<void> {
  const { cloudImportJobId } = job.data as { cloudImportJobId: string }

  const importJob = await prisma.cloudImportJob.findUnique({
    where: { id: cloudImportJobId },
    include: {
      user: {
        select: {
          id: true,
          soundcloudAccessTokenEnc: true,
          channel: { select: { id: true, slug: true } },
        },
      },
    },
  })

  if (!importJob) throw new Error(`CloudImportJob ${cloudImportJobId} not found`)
  if (importJob.source !== 'SOUNDCLOUD') {
    throw new Error(`Unsupported cloud import source: ${importJob.source}`)
  }

  const channel = importJob.user.channel
  if (!channel) {
    await prisma.cloudImportJob.update({
      where: { id: cloudImportJobId },
      data: { status: 'FAILED', error: 'Channel not found', completedAt: new Date() },
    })
    return
  }

  if (!importJob.user.soundcloudAccessTokenEnc) {
    await prisma.cloudImportJob.update({
      where: { id: cloudImportJobId },
      data: { status: 'FAILED', error: 'SoundCloud not connected', completedAt: new Date() },
    })
    return
  }

  await prisma.cloudImportJob.update({
    where: { id: cloudImportJobId },
    data: { status: 'DOWNLOADING' },
  })

  try {
    const token = decryptStreamKey(importJob.user.soundcloudAccessTokenEnc)

    // Re-fetch the track rather than trust anything cached client-side — the
    // download_url can rotate, and this confirms the track is still downloadable.
    const trackRes = await fetch(`https://api.soundcloud.com/tracks/${importJob.externalFileId}`, {
      headers: { Authorization: `OAuth ${token}`, Accept: 'application/json; charset=utf-8' },
    })
    if (!trackRes.ok) {
      throw new Error(
        trackRes.status === 401
          ? 'SoundCloud token expired — reconnect'
          : `SoundCloud track lookup failed (${trackRes.status})`,
      )
    }
    const track = (await trackRes.json()) as SoundcloudTrack
    if (!track.downloadable || !track.download_url) {
      throw new Error('Track is no longer downloadable')
    }

    const fileRes = await fetch(track.download_url, {
      headers: { Authorization: `OAuth ${token}` },
    })
    if (!fileRes.ok || !fileRes.body) {
      throw new Error(`SoundCloud download failed (${fileRes.status})`)
    }

    const contentType = fileRes.headers.get('content-type') ?? undefined
    const contentLengthHeader = fileRes.headers.get('content-length')
    const contentLength = contentLengthHeader ? Number(contentLengthHeader) : undefined
    const ext = extensionFromDriveFile('', contentType)
    const rawKey = `raw/${channel.slug}/${randomBytes(8).toString('hex')}.${ext}`
    const nodeStream = Readable.fromWeb(fileRes.body as ReadableStream<Uint8Array>)

    await uploadStream(rawKey, nodeStream, contentType || 'application/octet-stream', contentLength)

    const archiveItem = await prisma.archiveItem.create({
      data: {
        channelId: channel.id,
        title: track.title,
        rawKey,
        fileSizeBytes: BigInt(contentLength ?? 0),
        status: 'PENDING',
        source: 'SOUNDCLOUD',
      },
      select: { id: true },
    })

    await prisma.cloudImportJob.update({
      where: { id: cloudImportJobId },
      data: {
        status: 'DONE',
        fileName: track.title,
        archiveItemId: archiveItem.id,
        bytesTransferred: contentLength !== undefined ? BigInt(contentLength) : null,
        completedAt: new Date(),
      },
    })

    await enqueueTranscodeArchive(archiveItem.id)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const reconnect = /401|403|token|connect/i.test(message)
    await prisma.cloudImportJob.update({
      where: { id: cloudImportJobId },
      data: {
        status: 'FAILED',
        error: reconnect ? `${message} — reconnect SoundCloud and retry` : message,
        completedAt: new Date(),
      },
    })
    throw err
  }
}
