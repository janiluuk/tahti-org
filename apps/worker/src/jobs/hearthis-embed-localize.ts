// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Job } from 'bullmq'
import { randomBytes } from 'node:crypto'
import { Readable } from 'node:stream'
import { prisma } from '@tahti/db'
import { extensionFromDriveFile } from '@tahti/shared'
import { createHearthisClient } from '@tahti/hearthis'
import { uploadStream } from '../lib/minio.js'
import { enqueueTranscodeArchive } from '../lib/queue.js'

const hearthis = createHearthisClient()

export async function processHearthisEmbedLocalizationJob(job: Job): Promise<void> {
  const { archiveItemId, trackUrl } = job.data as {
    archiveItemId: string
    trackUrl: string
  }
  const archiveItem = await prisma.archiveItem.findUnique({
    where: { id: archiveItemId },
    select: { id: true, source: true, rawKey: true, channel: { select: { slug: true } } },
  })
  if (!archiveItem || archiveItem.rawKey || archiveItem.source !== 'HEARTHIS_EMBED') return

  const track = await hearthis.getTrackByUrl(trackUrl)
  if (track.downloadable !== '1' || !track.download_url) return

  const response = await fetch(track.download_url)
  if (!response.ok || !response.body) {
    throw new Error(`hearthis.at download failed (${response.status})`)
  }

  const contentType = response.headers.get('content-type') ?? 'application/octet-stream'
  const contentLengthHeader = response.headers.get('content-length')
  const contentLength = contentLengthHeader ? Number(contentLengthHeader) : undefined
  const extension = extensionFromDriveFile(track.download_filename ?? track.title, contentType)
  const rawKey = `raw/${archiveItem.channel.slug}/${randomBytes(8).toString('hex')}.${extension}`
  const stream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>)

  await uploadStream(rawKey, stream, contentType, contentLength)
  await prisma.archiveItem.update({
    where: { id: archiveItem.id },
    data: {
      rawKey,
      fileSizeBytes: BigInt(contentLength ?? 0),
      source: 'HEARTHIS',
      status: 'PENDING',
    },
  })
  await enqueueTranscodeArchive(archiveItem.id)
}
