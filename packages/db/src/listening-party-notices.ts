// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@prisma/client'
import { availableUserWhere } from './available-user.js'
import { actorDisplayName } from './display-name.js'

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
    select: { followerUserId: true },
  })
  if (followers.length === 0) return 0
  await prisma.notification.createMany({
    data: followers.map((f) => ({
      userId: f.followerUserId,
      type: 'LISTENING_PARTY_SCHEDULED' as const,
      actorUserId: host.id,
      title: `${actorDisplayName(host)} scheduled a listening party`,
      body: `"${party.release.title}" · ${partyStartLabel(party.startAt)}`,
      url: `/party/${party.id}`,
    })),
  })
  return followers.length
}
