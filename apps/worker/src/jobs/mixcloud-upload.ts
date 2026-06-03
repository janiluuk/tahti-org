// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import type { Job } from 'bullmq'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { prisma } from '@tahti/db'
import { uploadToMixcloud } from '@tahti/mixcloud'
import { downloadToFile } from '../lib/minio.js'

export async function processMixcloudUploadJob(job: Job): Promise<void> {
  const { mixUploadId } = job.data as { mixUploadId: string }

  const upload = await prisma.mixUpload.findUnique({
    where: { id: mixUploadId },
    include: {
      archiveItem: { select: { title: true, mp3Key: true, rawKey: true } },
    },
  })

  if (!upload) throw new Error(`MixUpload ${mixUploadId} not found`)

  await prisma.mixUpload.update({
    where: { id: mixUploadId },
    data: { status: 'UPLOADING' },
  })

  const tmpDir = await mkdtemp(join(tmpdir(), 'tahti-mixcloud-'))

  try {
    const audioKey = upload.archiveItem.mp3Key ?? upload.archiveItem.rawKey
    const audioPath = join(tmpDir, 'mix.mp3')
    await downloadToFile(audioKey, audioPath)

    // Access token stored per-user; for now we read from a future user.mixcloudToken field.
    // Until OAuth wiring is complete, stub mode kicks in (MIXCLOUD_CLIENT_ID not set in dev).
    const result = await uploadToMixcloud({
      accessToken: '', // populated via user.mixcloudToken once OAuth is wired
      name: upload.archiveItem.title,
      audioPath,
    })

    await prisma.mixUpload.update({
      where: { id: mixUploadId },
      data: {
        status: 'DONE',
        mixcloudKey: result.key,
        mixcloudUrl: result.url,
        completedAt: new Date(),
      },
    })
  } catch (err) {
    await prisma.mixUpload.update({
      where: { id: mixUploadId },
      data: {
        status: 'FAILED',
        error: err instanceof Error ? err.message : String(err),
      },
    })
    throw err
  } finally {
    await rm(tmpDir, { recursive: true, force: true })
  }
}
