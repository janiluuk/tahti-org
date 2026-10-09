// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'
import { availableUserWhere } from '@tahti/db'

/** Members who can still read a notification, without the board member who
 * made the change (they already know). */
async function membersToNotify(prisma: PrismaClient, actorUserId: string): Promise<string[]> {
  const members = await prisma.user.findMany({
    where: { isMember: true, id: { not: actorUserId }, ...availableUserWhere },
    select: { id: true },
  })
  return members.map((member) => member.id)
}

/**
 * Tells every member that a motion is open for voting. Until now a member
 * only found an open motion by visiting the governance page, so a short
 * voting window could pass unnoticed. Returns how many were told.
 */
export async function notifyMembersOfMotionOpened(
  prisma: PrismaClient,
  motion: { id: string; title: string; closeAt: Date },
  actorUserId: string,
): Promise<number> {
  const ids = await membersToNotify(prisma, actorUserId)
  if (ids.length === 0) return 0
  await prisma.notification.createMany({
    data: ids.map((userId) => ({
      userId,
      type: 'MOTION_OPENED' as const,
      actorUserId,
      title: 'A motion is open for voting',
      body: `"${motion.title}" is open until ${motion.closeAt.toISOString().slice(0, 10)}.`,
      url: `/governance/motions/${motion.id}`,
    })),
  })
  return ids.length
}
