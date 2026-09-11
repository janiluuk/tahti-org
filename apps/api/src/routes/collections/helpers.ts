// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyInstance } from 'fastify'
import { soundPlaybackKey } from '@tahti/shared'
import { presignedGetUrl } from '../../lib/minio.js'
import { resolveGatedPlaybackUrl } from '../../lib/playback-url.js'

export function zodError(
  reply: { status: (n: number) => { send: (b: unknown) => unknown } },
  err: { issues: Array<{ message?: string }> },
) {
  return reply.status(400).send({ error: err.issues[0]?.message ?? 'Invalid request body' })
}

export const collectionItemInclude = {
  sound: {
    select: {
      id: true,
      title: true,
      durationSec: true,
      mp3Key: true,
      flacKey: true,
      bannerUrl: true,
      description: true,
      createdAt: true,
      source: true,
      qualityBadge: true,
      embedUri: true,
      embedProvider: true,
      accessMode: true,
      purchaseTierId: true,
      channel: { select: { slug: true, userId: true } },
    },
  },
  release: {
    select: {
      id: true,
      title: true,
      type: true,
      smartLinkSlug: true,
      releaseDate: true,
      artworkUrl: true,
      description: true,
      tracks: {
        where: { status: 'READY' },
        orderBy: { position: 'asc' },
        take: 1,
        select: { id: true, title: true, streamKey: true, sourceKey: true },
      },
    },
  },
  addedBy: {
    select: { username: true, displayName: true },
  },
} as const

export async function addManagementPlayback<
  T extends {
    items: Array<{
      sound: {
        mp3Key: string | null
        flacKey: string | null
        accessMode: 'FREE' | 'SUBSCRIBERS_ONLY' | 'PURCHASE'
        purchaseTierId: string | null
        channel: { userId: string }
      } | null
      release: { tracks: Array<{ streamKey: string | null; sourceKey: string | null }> } | null
    }>
  },
>(fastify: FastifyInstance, collection: T, viewerUserId: string) {
  return {
    ...collection,
    items: await Promise.all(
      collection.items.map(async (item) => {
        const soundKey = item.sound ? soundPlaybackKey(item.sound) : null
        const releaseTrack = item.release?.tracks[0]
        const releaseKey = releaseTrack?.streamKey ?? releaseTrack?.sourceKey ?? null
        const playbackKey = soundKey ?? releaseKey
        if (!item.sound) {
          return {
            ...item,
            audioUrl: playbackKey ? await presignedGetUrl(playbackKey, 60 * 60) : null,
          }
        }
        const { url } = await resolveGatedPlaybackUrl(fastify.prisma, {
          playbackKey,
          artistUserId: item.sound.channel.userId,
          accessMode: item.sound.accessMode,
          purchaseTierId: item.sound.purchaseTierId,
          viewerUserId,
          ttlSec: 60 * 60,
        })
        return { ...item, audioUrl: url }
      }),
    ),
  }
}

type SortableItem = {
  position: number
  sound: { title: string; createdAt: Date } | null
  release: { title: string; releaseDate: Date } | null
}

/** MANUAL keeps drag-reordered position; TIME/NAME are computed for display, not persisted. */
export function sortCollectionItems<T extends SortableItem>(items: T[], mode: string): T[] {
  const itemTitle = (i: T) => i.sound?.title ?? i.release?.title ?? ''
  const itemTime = (i: T) => i.sound?.createdAt ?? i.release?.releaseDate ?? new Date(0)
  if (mode === 'NAME') {
    return [...items].sort((a, b) => itemTitle(a).localeCompare(itemTitle(b)))
  }
  if (mode === 'TIME') {
    return [...items].sort((a, b) => itemTime(a).getTime() - itemTime(b).getTime())
  }
  return items
}
