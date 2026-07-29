// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { mkdir, readdir, stat, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { PrismaClient } from '@tahti/db'
import {
  buildFallbackPlaybackRows,
  channelArchiveCacheDir,
  interleaveAnnouncements,
  localCacheBasename,
  renderLocalFallbackM3u,
} from '@tahti/shared'
import type { AnnouncementPlaybackRow, FallbackPlaybackRow } from '@tahti/shared'
import { downloadToFile, objectByteSize } from './minio.js'

// System (admin-managed) announcement clips, gated on the global kill-switch —
// mirrors apps/api/src/routes/internal/channel-fallback.ts's helper exactly,
// since both paths need identical announcement behavior regardless of
// whether Liquidsoap ends up reading the local cache or the remote M3U.
async function systemAnnouncementRows(prisma: PrismaClient): Promise<AnnouncementPlaybackRow[]> {
  const settings = await prisma.announcementSettings.findUnique({ where: { id: 'global' } })
  if (settings && !settings.systemEnabled) return []

  const clips = await prisma.announcementClip.findMany({
    where: { channelId: null, isEnabled: true },
    select: {
      id: true,
      title: true,
      audioKey: true,
      durationSec: true,
      scheduleMode: true,
      everyNth: true,
    },
  })
  return clips.map((c) => ({
    id: c.id,
    title: c.title,
    playbackKey: c.audioKey,
    durationSec: c.durationSec,
    scheduleMode: c.scheduleMode,
    everyNth: c.everyNth,
  }))
}

async function ownAnnouncementRows(
  prisma: PrismaClient,
  channelId: string,
): Promise<FallbackPlaybackRow[]> {
  const clips = await prisma.announcementClip.findMany({
    where: { channelId, isEnabled: true },
    select: { id: true, title: true, audioKey: true, durationSec: true },
  })
  return clips.map((c) => ({
    id: c.id,
    title: c.title,
    playbackKey: c.audioKey,
    durationSec: c.durationSec,
  }))
}

export type ArchiveFallbackCacheSummary = {
  downloaded: number
  skipped: number
  pruned: number
}

/** STREAM-009: mirror fallback rotation pool from MinIO to local disk for Liquidsoap. */
export async function syncChannelArchiveFallbackCache(
  prisma: PrismaClient,
  channelId: string,
  cacheRoot: string,
  maxItems = parseInt(process.env.ARCHIVE_CACHE_MAX_ITEMS ?? '24', 10),
): Promise<ArchiveFallbackCacheSummary> {
  const summary: ArchiveFallbackCacheSummary = { downloaded: 0, skipped: 0, pruned: 0 }

  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: { fallbackMode: true, fallbackEnabled: true, announcementsEnabled: true },
  })
  if (!channel) return summary

  const items = channel.fallbackEnabled
    ? await prisma.archiveItem.findMany({
        where: {
          channelId,
          status: 'READY',
          OR: [{ mp3Key: { not: null } }, { flacKey: { not: null } }],
        },
        select: {
          id: true,
          title: true,
          mp3Key: true,
          flacKey: true,
          durationSec: true,
          isFallback: true,
          fallbackOrder: true,
          lastFallbackPlayedAt: true,
          createdAt: true,
        },
      })
    : []

  const baseRows = buildFallbackPlaybackRows(items, channel.fallbackMode).slice(0, maxItems)
  const [systemAnnouncements, ownAnnouncements] = await Promise.all([
    systemAnnouncementRows(prisma),
    channel.announcementsEnabled ? ownAnnouncementRows(prisma, channelId) : [],
  ])
  const rows = interleaveAnnouncements(baseRows, systemAnnouncements, ownAnnouncements)
  const channelDir = channelArchiveCacheDir(cacheRoot, channelId)
  await mkdir(channelDir, { recursive: true })

  const keepNames = new Set<string>()

  for (const row of rows) {
    const basename = localCacheBasename(row.playbackKey)
    keepNames.add(basename)
    const destPath = join(channelDir, basename)

    const remoteSize = await objectByteSize(row.playbackKey)
    if (remoteSize != null) {
      try {
        const local = await stat(destPath)
        if (local.isFile() && local.size === remoteSize) {
          summary.skipped++
          continue
        }
      } catch {
        // download below
      }
    }

    await downloadToFile(row.playbackKey, destPath)
    summary.downloaded++
  }

  let existing: string[]
  try {
    existing = await readdir(channelDir)
  } catch {
    existing = []
  }

  for (const name of existing) {
    if (name === 'fallback.m3u') continue
    if (keepNames.has(name)) continue
    await unlink(join(channelDir, name))
    summary.pruned++
  }

  const m3u = renderLocalFallbackM3u(rows, channelDir)
  await writeFile(join(channelDir, 'fallback.m3u'), m3u, 'utf8')

  return summary
}
