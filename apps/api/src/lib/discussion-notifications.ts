// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'
import { availableUserWhere } from '@tahti/db'
import { membersToNotify } from './motion-notifications.js'
import { recordMentions } from './mentions.js'

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

/** Tells every other member that the board opened a topic. Returns how many
 * were told. */
export async function notifyMembersOfDiscussionOpened(
  prisma: PrismaClient,
  topic: { id: string; title: string },
  actorUserId: string,
): Promise<number> {
  const ids = await membersToNotify(prisma, actorUserId)
  if (ids.length === 0) return 0
  await prisma.notification.createMany({
    data: ids.map((userId) => ({
      userId,
      type: 'DISCUSSION_OPENED' as const,
      actorUserId,
      title: 'The board opened a discussion',
      body: `Join the conversation: "${topic.title}".`,
      url: `/governance/discussions/${topic.id}`,
    })),
  })
  return ids.length
}

/** Tells a closed topic's followers (muted ones too: closing is final, not
 * chatter) that it takes no more replies, without the board member who
 * closed it. Returns how many were told. */
export async function notifyDiscussionClosed(
  prisma: PrismaClient,
  topic: { id: string; title: string },
  actorUserId: string,
): Promise<number> {
  const participants = await prisma.discussionParticipant.findMany({
    where: {
      topicId: topic.id,
      userId: { not: actorUserId },
      user: { isMember: true, ...availableUserWhere },
    },
    select: { userId: true },
  })
  if (participants.length === 0) return 0
  await prisma.notification.createMany({
    data: participants.map(({ userId }) => ({
      userId,
      type: 'DISCUSSION_CLOSED' as const,
      actorUserId,
      title: 'A discussion you follow was closed',
      body: `"${topic.title}" takes no more replies.`,
      url: `/governance/discussions/${topic.id}`,
    })),
  })
  return participants.length
}

/** Records @mentions in a discussion reply (the Mentions page) and tells the
 * mentioned members, skipping anyone who turned mentions off, muted or
 * blocked the replier. Non-members can't open the topic, so they are not
 * told. Returns how many were told. */
export async function notifyDiscussionMentions(
  prisma: PrismaClient,
  topic: { id: string; title: string },
  post: { id: bigint; body: string },
  actorUserId: string,
): Promise<number> {
  const targetIds = await recordMentions(
    prisma,
    actorUserId,
    post.body,
    'DISCUSSION',
    `${topic.id}:${post.id.toString()}`,
  )
  if (targetIds.length === 0) return 0
  const members = await prisma.user.findMany({
    where: { id: { in: targetIds }, isMember: true },
    select: { id: true },
  })
  if (members.length === 0) return 0
  await prisma.notification.createMany({
    data: members.map(({ id }) => ({
      userId: id,
      type: 'DISCUSSION_MENTION' as const,
      actorUserId,
      title: 'You were mentioned in a discussion',
      body: `In "${topic.title}".`,
      url: `/governance/discussions/${topic.id}`,
    })),
  })
  return members.length
}
