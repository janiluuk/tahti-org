// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Job } from 'bullmq'
import type { PrismaClient } from '@tahti/db'
import { syncChannelHlsToMinio } from '../lib/hls-minio-sync.js'

export async function processHlsMinioSyncJob(
  prisma: PrismaClient,
  _job: Job,
): Promise<{ channels: number; uploaded: number; skipped: number }> {
  const hlsRoot = process.env.HLS_SEGMENT_ROOT ?? ''
  if (!hlsRoot) {
    return { channels: 0, uploaded: 0, skipped: 0 }
  }

  const live = await prisma.channel.findMany({
    where: { state: 'LIVE' },
    select: { id: true, slug: true },
  })

  let uploaded = 0
  let skipped = 0

  for (const ch of live) {
    const result = await syncChannelHlsToMinio(hlsRoot, ch.id, ch.slug)
    uploaded += result.uploaded
    skipped += result.skipped
  }

  if (uploaded > 0) {
    console.log(`[hls-minio-sync] uploaded=${uploaded} skipped=${skipped} channels=${live.length}`)
  }

  return { channels: live.length, uploaded, skipped }
}
