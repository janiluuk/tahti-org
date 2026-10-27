// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'
import { availableUserWhere } from '@tahti/db'

/**
 * Tells a topic's participants that someone replied, skipping the replier and
 * anyone who muted the topic. A participant who still has an unread notice
 * for the topic is not told again, so a busy thread is one bell entry until
 * they read it. Returns how many were told.
 */
export async function notifyDiscussionParticipants(
  prisma: PrismaClient,
  topic: { id: string; title: string },
  actorUserId: string,
): Promise<number> {
  const url = `/governance/discussions/${topic.id}`
  const participants = await prisma.discussionParticipant.findMany({
    where: {
      topicId: topic.id,
      mutedAt: null,
      userId: { not: actorUserId },
      user: { isMember: true, ...availableUserWhere },
    },
    select: { userId: true },
  })
  if (participants.length === 0) return 0
  const unread = await prisma.notification.findMany({
    where: {
      userId: { in: participants.map((p) => p.userId) },
      type: 'DISCUSSION_REPLY',
      url,
      readAt: null,
    },
    select: { userId: true },
  })
  const alreadyTold = new Set(unread.map((n) => n.userId))
  const ids = participants.map((p) => p.userId).filter((id) => !alreadyTold.has(id))
  if (ids.length === 0) return 0
  await prisma.notification.createMany({
    data: ids.map((userId) => ({
      userId,
      type: 'DISCUSSION_REPLY' as const,
      actorUserId,
      title: 'New reply in a discussion you follow',
      body: `Someone replied to "${topic.title}".`,
      url,
    })),
  })
  return ids.length
}
