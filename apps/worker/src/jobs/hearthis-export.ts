// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Job } from 'bullmq'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, extname } from 'node:path'
import { prisma, getUserIntegrationCredential } from '@tahti/db'
import { downloadToFile } from '../lib/minio.js'
import { uploadTrackToHearthis } from '../lib/hearthis-export-client.js'

export async function processHearthisExportJob(job: Job): Promise<void> {
  const { archiveItemId } = job.data as { archiveItemId: string }

  const item = await prisma.archiveItem.findUnique({
    where: { id: archiveItemId },
    select: {
      id: true,
      title: true,
      rawKey: true,
      flacKey: true,
      mp3Key: true,
      channel: { select: { userId: true } },
    },
  })
  if (!item) throw new Error(`ArchiveItem ${archiveItemId} not found`)

  const sourceKey = item.rawKey ?? item.flacKey ?? item.mp3Key
  if (!sourceKey) throw new Error(`ArchiveItem ${archiveItemId} has no audio file to export`)

  const credential = await getUserIntegrationCredential(
    prisma,
    item.channel.userId,
    'hearthis-export',
  )
  if (!credential?.apiKey) {
    await prisma.archiveItem.update({
      where: { id: archiveItemId },
      data: { hearthisExportStatus: 'failed' },
    })
    throw new Error(`ArchiveItem ${archiveItemId}: hearthis-export credential not installed`)
  }

  const tmpDir = await mkdtemp(join(tmpdir(), 'tahti-hearthis-export-'))
  try {
    const ext = extname(sourceKey).slice(1) || 'mp3'
    const srcPath = join(tmpDir, `source.${ext}`)
    await downloadToFile(sourceKey, srcPath)
    const audioBuffer = await readFile(srcPath)

    const result = await uploadTrackToHearthis(credential.apiKey, {
      title: item.title,
      audioBuffer,
      filename: `${item.id}.${ext}`,
    })

    await prisma.archiveItem.update({
      where: { id: archiveItemId },
      data: {
        hearthisExportId: result.remoteId,
        hearthisExportStatus: 'delivered',
        hearthisExportedAt: new Date(),
      },
    })
  } catch (err) {
    await prisma.archiveItem.update({
      where: { id: archiveItemId },
      data: { hearthisExportStatus: 'failed' },
    })
    throw err
  } finally {
    await rm(tmpDir, { recursive: true, force: true })
  }
}
