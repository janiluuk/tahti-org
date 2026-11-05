// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'
import { availableUserWhere } from '@tahti/db'

type GroupRef = { id: string; slug: string; name: string }

/** The group's owner and admins who can act on a request, without the actor. */
async function groupManagerIds(
  prisma: PrismaClient,
  groupId: string,
  actorUserId: string,
): Promise<string[]> {
  const managers = await prisma.artistGroupMember.findMany({
    where: {
      groupId,
      role: { in: ['OWNER', 'ADMIN'] },
      userId: { not: actorUserId },
      user: availableUserWhere,
    },
    select: { userId: true },
  })
  return managers.map((m) => m.userId)
}

/** Tells a group's owner and admins that someone asked to join. Returns how
 * many were told. */
export async function notifyGroupJoinRequested(
  prisma: PrismaClient,
  group: GroupRef,
  requesterUserId: string,
): Promise<number> {
  const ids = await groupManagerIds(prisma, group.id, requesterUserId)
  if (ids.length === 0) return 0
  await prisma.notification.createMany({
    data: ids.map((userId) => ({
      userId,
      type: 'GROUP_JOIN_REQUESTED' as const,
      actorUserId: requesterUserId,
      title: 'New request to join your group',
      body: `Someone asked to join ${group.name}.`,
      url: `/studio/groups/${group.slug}`,
    })),
  })
  return ids.length
}

/** Tells someone that a group admin approved or declined their request to
 * join. */
export async function notifyGroupJoinResolved(
  prisma: PrismaClient,
  group: GroupRef,
  requesterUserId: string,
  approved: boolean,
  actorUserId: string,
): Promise<void> {
  await prisma.notification.create({
    data: {
      userId: requesterUserId,
      type: 'GROUP_JOIN_RESOLVED',
      actorUserId,
      title: approved ? `You joined ${group.name}` : 'Your request to join was declined',
      body: approved
        ? `Your request to join ${group.name} was approved.`
        : `${group.name} declined your request to join.`,
      url: `/groups/${group.slug}`,
    },
  })
}

/** Tells a group's owner and admins that a member submitted a track for the
 * group playlist. Returns how many were told. */
export async function notifyGroupSubmissionReceived(
  prisma: PrismaClient,
  group: GroupRef,
  submitterUserId: string,
  soundTitle: string,
): Promise<number> {
  const ids = await groupManagerIds(prisma, group.id, submitterUserId)
  if (ids.length === 0) return 0
  await prisma.notification.createMany({
    data: ids.map((userId) => ({
      userId,
      type: 'GROUP_SUBMISSION_RECEIVED' as const,
      actorUserId: submitterUserId,
      title: 'A track is waiting for your group',
      body: `"${soundTitle}" was submitted to ${group.name}.`,
      url: `/studio/groups/${group.slug}`,
    })),
  })
  return ids.length
}

/** Tells a member whether the track they submitted made it into the group
 * playlist. */
export async function notifyGroupSubmissionResolved(
  prisma: PrismaClient,
  group: GroupRef,
  submitterUserId: string,
  soundTitle: string,
  approved: boolean,
  actorUserId: string,
): Promise<void> {
  if (submitterUserId === actorUserId) return
  await prisma.notification.create({
    data: {
      userId: submitterUserId,
      type: 'GROUP_SUBMISSION_RESOLVED',
      actorUserId,
      title: approved ? 'Your track is in the group playlist' : 'Your track was not added',
      body: approved
        ? `"${soundTitle}" was added to ${group.name}.`
        : `${group.name} declined "${soundTitle}".`,
      url: `/groups/${group.slug}`,
    },
  })
}
