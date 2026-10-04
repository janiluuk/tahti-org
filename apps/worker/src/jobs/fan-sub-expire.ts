// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { actorDisplayName, type PrismaClient } from '@tahti/db'

const GRACE_MS = 7 * 24 * 60 * 60 * 1000

/** Expires lapsed subscriptions (and canceled ones past their grace week),
 * then tells each fan their subscription ended, with a link to subscribe
 * again. */
export async function processFanSubExpire(prisma: PrismaClient, now: Date = new Date()) {
  const graceCutoff = new Date(now.getTime() - GRACE_MS)
  const where = {
    OR: [
      { state: 'ACTIVE' as const, currentPeriodEnd: { lt: now } },
      { state: 'CANCELED' as const, currentPeriodEnd: { lt: graceCutoff } },
    ],
  }
  const ending = await prisma.fanSubscription.findMany({
    where,
    select: {
      id: true,
      subscriberUserId: true,
      artistUserId: true,
      tierName: true,
      artist: { select: { username: true, displayName: true } },
      subscriber: { select: { deletedAt: true } },
    },
  })
  if (ending.length === 0) return { expired: 0 }

  const expired = await prisma.fanSubscription.updateMany({
    where: { id: { in: ending.map((s) => s.id) }, ...where },
    data: { state: 'EXPIRED' },
  })

  await prisma.notification.createMany({
    data: ending
      .filter((sub) => !sub.subscriber.deletedAt)
      .map((sub) => ({
        userId: sub.subscriberUserId,
        type: 'FAN_SUB_EXPIRED' as const,
        actorUserId: sub.artistUserId,
        title: `Your ${sub.tierName} subscription to ${actorDisplayName(sub.artist)} has ended`,
        body: 'Subscribe again any time to get your fan access back.',
        url: `/subscribe/${sub.artist.username}`,
      })),
  })

  return { expired: expired.count }
}
