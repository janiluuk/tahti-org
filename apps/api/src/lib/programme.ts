// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'
import { archivePlaybackKey, type ChannelProgrammePatch } from '@tahti/shared'
import { presignedGetUrl } from './minio.js'

/** Shared by the artist's own rotation editor (routes/me/programme.ts) and the
 * board's per-channel equivalent (routes/admin/channels.ts) — same business
 * logic either way, only how `channelId`/`userId` get resolved differs (session
 * user vs. :slug route param). */

const ARCHIVE_ITEM_SELECT = {
  id: true,
  title: true,
  status: true,
  durationSec: true,
  isFallback: true,
  fallbackOrder: true,
  lastFallbackPlayedAt: true,
  createdAt: true,
  mp3Key: true,
  flacKey: true,
} as const

/** Presigning is a local HMAC signature, not a network call — cheap even for the
 * editor's full item list (capped at PROGRAMME_ITEM_CAP). Editor-only preview
 * playback, so a shorter TTL than the fallback playlist's is fine. */
const PROGRAMME_PREVIEW_URL_TTL_SEC = 60 * 60

// PERF-008: the rotation editor (schedule/_rotation-editor.tsx) filters this
// list client-side to derive "in rotation" vs "available" — it needs to see
// the whole set to do that, so real page/limit pagination would break the
// editor's UX. This caps worst-case query cost instead (matching the
// precedent in routes/me/archive.ts's own take: 100), rather than the
// unbounded findManys this had before.
const PROGRAMME_ITEM_CAP = 500

export async function fetchProgrammeView(prisma: PrismaClient, channelId: string, userId: string) {
  const [channel, items, tracks] = await Promise.all([
    prisma.channel.findUnique({
      where: { id: channelId },
      select: { fallbackMode: true, fallbackEnabled: true },
    }),
    prisma.archiveItem.findMany({
      where: { channelId, status: 'READY' },
      orderBy: [{ fallbackOrder: 'asc' }, { createdAt: 'asc' }],
      take: PROGRAMME_ITEM_CAP,
      select: ARCHIVE_ITEM_SELECT,
    }),
    prisma.releaseTrack.findMany({
      where: { release: { userId }, status: 'READY' },
      orderBy: [{ createdAt: 'asc' }],
      take: PROGRAMME_ITEM_CAP,
      select: {
        id: true,
        title: true,
        durationSec: true,
        archiveItemId: true,
        release: { select: { id: true, title: true } },
      },
    }),
  ])

  const itemsWithAudio = await Promise.all(
    items.map(async ({ mp3Key, flacKey, ...rest }) => {
      const playbackKey = archivePlaybackKey({ mp3Key, flacKey })
      return {
        ...rest,
        audioUrl: playbackKey
          ? await presignedGetUrl(playbackKey, PROGRAMME_PREVIEW_URL_TTL_SEC)
          : null,
      }
    }),
  )

  return {
    fallbackMode: channel?.fallbackMode ?? 'shuffle',
    fallbackEnabled: channel?.fallbackEnabled ?? true,
    items: itemsWithAudio,
    library: tracks.map((t) => ({
      releaseTrackId: t.id,
      releaseId: t.release.id,
      releaseTitle: t.release.title,
      trackTitle: t.title,
      durationSec: t.durationSec,
      archiveItemId: t.archiveItemId,
    })),
  }
}

/** Applies a fallbackMode/fallbackEnabled/items patch to an already-resolved,
 * already-authorized channel. Returns an error message on the one caller-facing
 * failure mode (an archiveItemId that doesn't belong to this channel) — every
 * other precondition (auth, channel ownership) is the caller's responsibility. */
export async function applyProgrammePatch(
  prisma: PrismaClient,
  channelId: string,
  patch: ChannelProgrammePatch,
): Promise<{ error: string | null }> {
  if (patch.fallbackMode !== undefined || patch.fallbackEnabled !== undefined) {
    await prisma.channel.update({
      where: { id: channelId },
      data: {
        ...(patch.fallbackMode !== undefined ? { fallbackMode: patch.fallbackMode } : {}),
        ...(patch.fallbackEnabled !== undefined ? { fallbackEnabled: patch.fallbackEnabled } : {}),
      },
    })
  }

  if (patch.items !== undefined) {
    const ids = patch.items.map((i) => i.archiveItemId)
    const owned = await prisma.archiveItem.findMany({
      where: { channelId, id: { in: ids } },
      select: { id: true },
    })
    const ownedIds = new Set(owned.map((o) => o.id))
    for (const row of patch.items) {
      if (!ownedIds.has(row.archiveItemId)) {
        return { error: `Unknown archive item ${row.archiveItemId}` }
      }
    }

    await prisma.$transaction(
      patch.items.map((row) =>
        prisma.archiveItem.update({
          where: { id: row.archiveItemId },
          data: {
            isFallback: row.isFallback,
            ...(row.fallbackOrder !== undefined ? { fallbackOrder: row.fallbackOrder } : {}),
          },
        }),
      ),
    )
  }

  return { error: null }
}

/** Pulls a published release track into the 24/7 rotation alongside archive sets
 * (M33) — reuses ArchiveItem as the single rotation/playback source of truth, so
 * the worker's fallback cache and Liquidsoap never need to know a row originated
 * from the release library. `channel` must already be resolved and authorized. */
export async function promoteReleaseTrackToProgramme(
  prisma: PrismaClient,
  channel: { id: string; userId: string },
  releaseTrackId: string,
): Promise<{ error: string | null }> {
  const track = await prisma.releaseTrack.findFirst({
    where: { id: releaseTrackId, release: { userId: channel.userId }, status: 'READY' },
    select: {
      id: true,
      title: true,
      durationSec: true,
      streamKey: true,
      flacKey: true,
      archiveItemId: true,
      release: { select: { title: true } },
    },
  })
  if (!track) return { error: 'Release track not found' }

  if (track.archiveItemId) {
    await prisma.archiveItem.update({
      where: { id: track.archiveItemId },
      data: { isFallback: true },
    })
    return { error: null }
  }

  if (!track.streamKey && !track.flacKey) {
    return { error: 'Track has no playable audio yet' }
  }

  const maxOrder = await prisma.archiveItem.aggregate({
    where: { channelId: channel.id },
    _max: { fallbackOrder: true },
  })

  const archiveItem = await prisma.archiveItem.create({
    data: {
      channelId: channel.id,
      title: `${track.release.title} — ${track.title}`,
      durationSec: track.durationSec,
      mp3Key: track.streamKey,
      flacKey: track.flacKey,
      status: 'READY',
      contentType: 'ORIGINAL',
      source: 'UPLOAD',
      isPublic: false,
      isFallback: true,
      fallbackOrder: (maxOrder._max.fallbackOrder ?? -1) + 1,
    },
    select: { id: true },
  })
  await prisma.releaseTrack.update({
    where: { id: track.id },
    data: { archiveItemId: archiveItem.id },
  })

  return { error: null }
}
