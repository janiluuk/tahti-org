// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'
import {
  availableUserWhere,
  groupDeletedCopy,
  groupJoinRequestedCopy,
  groupJoinResolvedCopy,
  groupMemberRemovedCopy,
  groupRoleChangedCopy,
  groupSubmissionReceivedCopy,
  groupSubmissionResolvedCopy,
  resolveNotificationLocale,
  type NotificationLocale,
} from '@tahti/db'

type GroupRef = { id: string; slug: string; name: string }

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
  const locales = await localesFor(prisma, ids)
  await prisma.notification.createMany({
    data: ids.map((userId) => {
      const copy = groupJoinRequestedCopy(locales.get(userId) ?? 'en', group.name)
      return {
        userId,
        type: 'GROUP_JOIN_REQUESTED' as const,
        actorUserId: requesterUserId,
        title: copy.title,
        body: copy.body,
        url: `/studio/groups/${group.slug}`,
      }
    }),
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
  const locales = await localesFor(prisma, [requesterUserId])
  const copy = groupJoinResolvedCopy(locales.get(requesterUserId) ?? 'en', group.name, approved)
  await prisma.notification.create({
    data: {
      userId: requesterUserId,
      type: 'GROUP_JOIN_RESOLVED',
      actorUserId,
      title: copy.title,
      body: copy.body,
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
  const locales = await localesFor(prisma, ids)
  await prisma.notification.createMany({
    data: ids.map((userId) => {
      const copy = groupSubmissionReceivedCopy(locales.get(userId) ?? 'en', group.name, soundTitle)
      return {
        userId,
        type: 'GROUP_SUBMISSION_RECEIVED' as const,
        actorUserId: submitterUserId,
        title: copy.title,
        body: copy.body,
        url: `/studio/groups/${group.slug}`,
      }
    }),
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
  const locales = await localesFor(prisma, [submitterUserId])
  const copy = groupSubmissionResolvedCopy(
    locales.get(submitterUserId) ?? 'en',
    group.name,
    soundTitle,
    approved,
  )
  await prisma.notification.create({
    data: {
      userId: submitterUserId,
      type: 'GROUP_SUBMISSION_RESOLVED',
      actorUserId,
      title: copy.title,
      body: copy.body,
      url: `/groups/${group.slug}`,
    },
  })
}

/** Tells someone a group admin took them out of a group. */
export async function notifyGroupMemberRemoved(
  prisma: PrismaClient,
  group: GroupRef,
  removedUserId: string,
  actorUserId: string,
): Promise<void> {
  const locales = await localesFor(prisma, [removedUserId])
  const copy = groupMemberRemovedCopy(locales.get(removedUserId) ?? 'en', group.name)
  await prisma.notification.create({
    data: {
      userId: removedUserId,
      type: 'GROUP_MEMBER_REMOVED',
      actorUserId,
      title: copy.title,
      body: copy.body,
      url: `/groups/${group.slug}`,
    },
  })
}

/** Tells a member their role in a group changed: made admin, back to member,
 * or handed the group. */
export async function notifyGroupRoleChanged(
  prisma: PrismaClient,
  group: GroupRef,
  memberUserId: string,
  role: 'OWNER' | 'ADMIN' | 'MEMBER',
  actorUserId: string,
): Promise<void> {
  const locales = await localesFor(prisma, [memberUserId])
  const copy = groupRoleChangedCopy(locales.get(memberUserId) ?? 'en', group.name, role)
  await prisma.notification.create({
    data: {
      userId: memberUserId,
      type: 'GROUP_ROLE_CHANGED',
      actorUserId,
      title: copy.title,
      body: copy.body,
      url: `/studio/groups/${group.slug}`,
    },
  })
}

/** Tells the members of a group the owner just deleted. Takes the member ids
 * read before the delete, since the membership rows go with the group. */
export async function notifyGroupDeleted(
  prisma: PrismaClient,
  groupName: string,
  memberUserIds: string[],
  actorUserId: string,
): Promise<number> {
  const ids = memberUserIds.filter((id) => id !== actorUserId)
  if (ids.length === 0) return 0
  const locales = await localesFor(prisma, ids)
  await prisma.notification.createMany({
    data: ids.map((userId) => {
      const copy = groupDeletedCopy(locales.get(userId) ?? 'en', groupName)
      return {
        userId,
        type: 'GROUP_DELETED' as const,
        actorUserId,
        title: copy.title,
        body: copy.body,
        url: '/groups',
      }
    }),
  })
  return ids.length
}
