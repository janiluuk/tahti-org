// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyInstance } from 'fastify'
import { safeDisplayName, soundPlaybackKey } from '@tahti/shared'
import { presignedGetUrl } from '../../lib/minio.js'
import { resolveGatedPlaybackUrl } from '../../lib/playback-url.js'

export function zodError(
  reply: { status: (n: number) => { send: (b: unknown) => unknown } },
  err: { issues: Array<{ message?: string }> },
) {
  return reply.status(400).send({ error: err.issues[0]?.message ?? 'Invalid request body' })
}

/** Items a public collection surface may show: the owner can keep private,
 * unfinished or draft entries in a public collection, and those stay
 * between them and the editor. */
export const publicCollectionItemWhere = {
  OR: [
    { sound: { isPublic: true, status: 'READY' as const } },
    { release: { state: 'PUBLISHED' as const } },
  ],
}

/** Collections anyone with the link may open: public ones, plus unlisted
 * ones, which stay out of profiles and discovery but work by link. */
export const linkReachableCollectionWhere = {
  OR: [{ isPublic: true }, { visibility: 'UNLISTED' as const }],
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
      isPublic: true,
      status: true,
      artistName: true,
      channel: {
        select: {
          slug: true,
          userId: true,
          user: { select: { username: true, displayName: true } },
        },
      },
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

type NamedUser = { username: string; displayName: string }

export function safeUser<U extends NamedUser>(user: U): U {
  return { ...user, displayName: safeDisplayName(user.displayName, user.username) }
}

/** A collection item whose contributor and track owner are never named by an
 * email address. */
export function withSafeNames<
  T extends {
    addedBy: NamedUser | null
    sound: { channel: { user: NamedUser } } | null
  },
>(item: T): T {
  return {
    ...item,
    addedBy: item.addedBy && safeUser(item.addedBy),
    sound: item.sound && {
      ...item.sound,
      channel: { ...item.sound.channel, user: safeUser(item.sound.channel.user) },
    },
  }
}

/** Who made a collection item's track, never named by an email address. */
export function soundArtist(sound: {
  artistName: string | null
  channel: { user: { username: string; displayName: string } }
}) {
  const { username, displayName } = sound.channel.user
  return {
    username,
    displayName: sound.artistName?.trim() || safeDisplayName(displayName, username),
  }
}

export async function addManagementPlayback<
  T extends {
    items: Array<{
      sound: {
        mp3Key: string | null
        flacKey: string | null
        accessMode: 'FREE' | 'SUBSCRIBERS_ONLY' | 'PURCHASE'
        purchaseTierId: string | null
        isPublic: boolean
        status: string
        artistName: string | null
        channel: { userId: string; user: { username: string; displayName: string } }
      } | null
      release: { tracks: Array<{ streamKey: string | null; sourceKey: string | null }> } | null
      addedBy: NamedUser | null
    }>
  },
>(fastify: FastifyInstance, collection: T, viewerUserId: string) {
  return {
    ...collection,
    items: await Promise.all(
      collection.items.map(async (unsafeItem) => {
        const item = withSafeNames(unsafeItem)
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
        // Someone else's track that has since gone private (or back to
        // processing) stays listed for the owner, but no longer plays.
        const withdrawn =
          item.sound.channel.userId !== viewerUserId &&
          (!item.sound.isPublic || item.sound.status !== 'READY')
        const sound = {
          ...item.sound,
          channel: { ...item.sound.channel, user: undefined },
          artist: soundArtist(item.sound),
        }
        if (withdrawn) return { ...item, sound, audioUrl: null, unavailable: true }
        const { url } = await resolveGatedPlaybackUrl(fastify.prisma, {
          playbackKey,
          artistUserId: item.sound.channel.userId,
          accessMode: item.sound.accessMode,
          purchaseTierId: item.sound.purchaseTierId,
          viewerUserId,
          ttlSec: 60 * 60,
        })
        return { ...item, sound, audioUrl: url }
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
