// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Job } from 'bullmq'
import type { PrismaClient } from '@tahti/db'
import { syncChannelArchiveFallbackCache } from '../lib/archive-fallback-cache.js'

export async function processWarmArchiveFallbackCacheJob(
  prisma: PrismaClient,
  job: Job,
): Promise<{ channelId: string; downloaded: number; skipped: number; pruned: number }> {
  const cacheRoot = process.env.ARCHIVE_CACHE_ROOT ?? ''
  const { channelId } = job.data as { channelId: string }
  if (!cacheRoot) {
    return { channelId, downloaded: 0, skipped: 0, pruned: 0 }
  }

  const summary = await syncChannelArchiveFallbackCache(prisma, channelId, cacheRoot)
  return { channelId, ...summary }
}

export async function processArchiveFallbackCacheSyncJob(
  prisma: PrismaClient,
  _job: Job,
): Promise<{ channels: number; downloaded: number; skipped: number; pruned: number }> {
  const cacheRoot = process.env.ARCHIVE_CACHE_ROOT ?? ''
  if (!cacheRoot) {
    return { channels: 0, downloaded: 0, skipped: 0, pruned: 0 }
  }

  const channels = await prisma.channel.findMany({
    where: {
      archiveItems: {
        some: {
          status: 'READY',
          OR: [{ mp3Key: { not: null } }, { flacKey: { not: null } }],
        },
      },
    },
    select: { id: true },
  })

  let downloaded = 0
  let skipped = 0
  let pruned = 0

  for (const ch of channels) {
    const result = await syncChannelArchiveFallbackCache(prisma, ch.id, cacheRoot)
    downloaded += result.downloaded
    skipped += result.skipped
    pruned += result.pruned
  }

  if (downloaded > 0 || pruned > 0) {
    console.log(
      `[archive-fallback-cache] channels=${channels.length} downloaded=${downloaded} skipped=${skipped} pruned=${pruned}`,
    )
  }

  return { channels: channels.length, downloaded, skipped, pruned }
}
