// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Job } from 'bullmq'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { prisma } from '@tahti/db'
import { archivePlaybackKey } from '@tahti/shared'
import { uploadToMixcloud } from '@tahti/mixcloud'
import { downloadToFile } from '../lib/minio.js'
import { decryptStreamKey } from '../lib/stream-key-enc.js'

export async function processMixcloudUploadJob(job: Job): Promise<void> {
  const { mixUploadId } = job.data as { mixUploadId: string }

  const upload = await prisma.mixUpload.findUnique({
    where: { id: mixUploadId },
    include: {
      user: { select: { mixcloudAccessTokenEnc: true } },
      archiveItem: { select: { title: true, mp3Key: true, flacKey: true, rawKey: true } },
    },
  })

  if (!upload) throw new Error(`MixUpload ${mixUploadId} not found`)

  const audioKey = archivePlaybackKey(upload.archiveItem) ?? upload.archiveItem.rawKey
  if (!audioKey) throw new Error(`MixUpload ${mixUploadId} has no audio (embed-only source?)`)

  await prisma.mixUpload.update({
    where: { id: mixUploadId },
    data: { status: 'UPLOADING' },
  })

  const tmpDir = await mkdtemp(join(tmpdir(), 'tahti-mixcloud-'))

  try {
    const audioPath = join(tmpDir, 'mix.mp3')
    await downloadToFile(audioKey, audioPath)

    const accessToken = upload.user.mixcloudAccessTokenEnc
      ? decryptStreamKey(upload.user.mixcloudAccessTokenEnc)
      : ''

    const result = await uploadToMixcloud({
      accessToken,
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
