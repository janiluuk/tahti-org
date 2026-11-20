// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@prisma/client'
import { availableUserWhere } from './available-user.js'
import { actorDisplayName } from './display-name.js'
import {
  listeningPartyChangedCopy,
  listeningPartyScheduledCopy,
  listeningPartyStartingCopy,
  resolveNotificationLocale,
  type NotificationLocale,
} from './notification-copy.js'

export type ListeningPartyRef = {
  id: string
  startAt: Date
  release: { title: string }
}

type Host = { id: string; username: string; displayName: string }

/** `2026-11-12 18:00 UTC`: notices are stored once for every reader, so
 * the time is spelled out in UTC rather than one reader's zone. */
export function partyStartLabel(startAt: Date): string {
  return `${startAt.toISOString().slice(0, 16).replace('T', ' ')} UTC`
}

async function localesFor(
  prisma: PrismaClient,
  userIds: string[],
): Promise<Map<string, NotificationLocale>> {
  if (userIds.length === 0) return new Map()
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, uiLocale: true },
  })
  return new Map(users.map((u) => [u.id, resolveNotificationLocale(u.uiLocale)]))
}

/** Tells the host's followers that a listening party was scheduled, unless
 * they blocked the host or the host blocked them. Returns how many were told. */
export async function notifyFollowersOfListeningParty(
  prisma: PrismaClient,
  host: Host,
  party: ListeningPartyRef,
): Promise<number> {
  const followers = await prisma.artistFollow.findMany({
    where: {
      artistUserId: host.id,
      follower: {
        ...availableUserWhere,
        blocksMade: { none: { blockedUserId: host.id } },
        blocksReceived: { none: { blockerUserId: host.id } },
      },
    },
    select: { followerUserId: true, follower: { select: { uiLocale: true } } },
  })
  if (followers.length === 0) return 0
  const name = actorDisplayName(host)
  const startLabel = partyStartLabel(party.startAt)
  await prisma.notification.createMany({
    data: followers.map((f) => {
      const copy = listeningPartyScheduledCopy(
        resolveNotificationLocale(f.follower.uiLocale),
        name,
        party.release.title,
        startLabel,
      )
      return {
        userId: f.followerUserId,
        type: 'LISTENING_PARTY_SCHEDULED' as const,
        actorUserId: host.id,
        title: copy.title,
        body: copy.body,
        url: `/party/${party.id}`,
      }
    }),
  })
  return followers.length
}

/** Everyone who asked to be reminded of a party and can still be told:
 * available accounts with no block either way with the host. */
async function remindedUserIds(
  prisma: PrismaClient,
  partyId: string,
  hostUserId: string,
): Promise<string[]> {
  const rows = await prisma.listeningPartyReminder.findMany({
    where: {
      partyId,
      userId: { not: hostUserId },
      user: {
        ...availableUserWhere,
        blocksMade: { none: { blockedUserId: hostUserId } },
        blocksReceived: { none: { blockerUserId: hostUserId } },
      },
    },
    select: { userId: true },
  })
  return rows.map((r) => r.userId)
}

/** Tells those who asked to be reminded that the party has started. Returns
 * how many were told. */
export async function notifyListeningPartyStarting(
  prisma: PrismaClient,
  host: Host,
  party: ListeningPartyRef,
): Promise<number> {
  const ids = await remindedUserIds(prisma, party.id, host.id)
  if (ids.length === 0) return 0
  const locales = await localesFor(prisma, ids)
  const name = actorDisplayName(host)
  await prisma.notification.createMany({
    data: ids.map((userId) => {
      const copy = listeningPartyStartingCopy(
        locales.get(userId) ?? 'en',
        name,
        party.release.title,
      )
      return {
        userId,
        type: 'LISTENING_PARTY_STARTING' as const,
        actorUserId: host.id,
        title: copy.title,
        body: copy.body,
        url: `/party/${party.id}`,
      }
    }),
  })
  return ids.length
}

/** Tells those who asked to be reminded that the party moved to a new time
 * or was cancelled. Returns how many were told. */
export async function notifyListeningPartyChanged(
  prisma: PrismaClient,
  host: Host,
  party: ListeningPartyRef,
  change: 'MOVED' | 'CANCELED',
): Promise<number> {
  const ids = await remindedUserIds(prisma, party.id, host.id)
  if (ids.length === 0) return 0
  const locales = await localesFor(prisma, ids)
  const name = actorDisplayName(host)
  const startLabel = partyStartLabel(party.startAt)
  await prisma.notification.createMany({
    data: ids.map((userId) => {
      const copy = listeningPartyChangedCopy(
        locales.get(userId) ?? 'en',
        name,
        party.release.title,
        change,
        startLabel,
      )
      return {
        userId,
        type: 'LISTENING_PARTY_CHANGED' as const,
        actorUserId: host.id,
        title: copy.title,
        body: copy.body,
        url: `/party/${party.id}`,
      }
    }),
  })
  return ids.length
}
