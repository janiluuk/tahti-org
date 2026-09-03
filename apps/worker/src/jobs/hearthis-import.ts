// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Job } from 'bullmq'
import { randomBytes } from 'node:crypto'
import { Readable } from 'node:stream'
import { prisma } from '@tahti/db'
import { extensionFromDriveFile } from '@tahti/shared'
import { createHearthisClient } from '@tahti/hearthis'
import { uploadStream } from '../lib/minio.js'
import { enqueueTranscodeSound } from '../lib/queue.js'

const hearthis = createHearthisClient()

export async function processHearthisImportJob(job: Job): Promise<void> {
  const { cloudImportJobId } = job.data as { cloudImportJobId: string }

  const importJob = await prisma.cloudImportJob.findUnique({
    where: { id: cloudImportJobId },
    include: {
      user: {
        select: {
          id: true,
          hearthisUsername: true,
          channel: { select: { id: true, slug: true } },
        },
      },
    },
  })

  if (!importJob) throw new Error(`CloudImportJob ${cloudImportJobId} not found`)
  if (importJob.source !== 'HEARTHIS') {
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

  if (!importJob.user.hearthisUsername) {
    await prisma.cloudImportJob.update({
      where: { id: cloudImportJobId },
      data: { status: 'FAILED', error: 'hearthis.at not connected', completedAt: new Date() },
    })
    return
  }

  await prisma.cloudImportJob.update({
    where: { id: cloudImportJobId },
    data: { status: 'DOWNLOADING' },
  })

  try {
    // Re-list from the connected username rather than trust anything cached
    // client-side — this is also the ownership check: hearthis.at has no
    // OAuth, so "the track appears under the username the artist told us is
    // theirs" is the only boundary available. A single-track lookup by id has
    // no documented endpoint; the user-tracks listing does.
    const tracks = await hearthis.getUserTracks(importJob.user.hearthisUsername, { count: 200 })
    const track = tracks.find((t) => t.id === importJob.externalFileId)
    if (!track) {
      throw new Error('Track no longer found under the connected hearthis.at account')
    }

    // Prefer the real download (often the artist's original upload quality,
    // sometimes lossless) over stream_url (always a compressed preview).
    const sourceUrl = track.download_url || track.stream_url
    if (!sourceUrl) throw new Error('No downloadable audio URL for this track')

    const fileRes = await fetch(sourceUrl)
    if (!fileRes.ok || !fileRes.body) {
      throw new Error(`hearthis.at download failed (${fileRes.status})`)
    }

    const contentType = fileRes.headers.get('content-type') ?? undefined
    const contentLengthHeader = fileRes.headers.get('content-length')
    const contentLength = contentLengthHeader ? Number(contentLengthHeader) : undefined
    const ext = extensionFromDriveFile(track.download_filename ?? '', contentType)
    const rawKey = `raw/${channel.slug}/${randomBytes(8).toString('hex')}.${ext}`
    const nodeStream = Readable.fromWeb(fileRes.body as ReadableStream<Uint8Array>)

    await uploadStream(rawKey, nodeStream, contentType || 'application/octet-stream', contentLength)

    const sound = await prisma.sound.create({
      data: {
        channelId: channel.id,
        title: track.title,
        rawKey,
        fileSizeBytes: BigInt(contentLength ?? 0),
        status: 'PENDING',
        source: 'HEARTHIS',
      },
      select: { id: true },
    })

    await prisma.cloudImportJob.update({
      where: { id: cloudImportJobId },
      data: {
        status: 'DONE',
        fileName: track.title,
        soundId: sound.id,
        bytesTransferred: contentLength !== undefined ? BigInt(contentLength) : null,
        completedAt: new Date(),
      },
    })

    await enqueueTranscodeSound(sound.id)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await prisma.cloudImportJob.update({
      where: { id: cloudImportJobId },
      data: { status: 'FAILED', error: message, completedAt: new Date() },
    })
    throw err
  }
}
