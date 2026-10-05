// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Prisma, PrismaClient } from '@tahti/db'
import { notifyUserOfNewMessage } from '@tahti/db'
import { CONVERSATION_PAGE_LIMIT } from '@tahti/shared'
import { availableUserWhere } from './listed-artist.js'
import { userName, withSafeName } from './safe-names.js'

export type ChannelStaffRole = 'owner' | 'moderator'

export const RECIPIENT_UNAVAILABLE_BODY = {
  error: 'This account is no longer available',
  code: 'recipient_unavailable',
} as const

const participantSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
} as const

const otherUserSelect = {
  ...participantSelect,
  deletedAt: true,
  suspendedAt: true,
} as const

function serializeParticipant(
  user: {
    username: string
    displayName: string
    avatarUrl: string | null
  },
  channelRole: ChannelStaffRole | null = null,
) {
  return {
    username: user.username,
    displayName: userName(user),
    avatarUrl: user.avatarUrl,
    channelRole,
  }
}

function serializeOtherUser(
  user: {
    username: string
    displayName: string
    avatarUrl: string | null
    deletedAt: Date | null
    suspendedAt: Date | null
  },
  channelRole: ChannelStaffRole | null,
) {
  return {
    ...serializeParticipant(user, channelRole),
    available: !user.deletedAt && !user.suspendedAt,
  }
}

/** Resolve channel-owner / moderator badges for a set of user ids. Owner wins. */
export async function resolveChannelStaffRoles(
  prisma: PrismaClient,
  userIds: string[],
): Promise<Map<string, ChannelStaffRole | null>> {
  const roles = new Map<string, ChannelStaffRole | null>()
  for (const id of userIds) roles.set(id, null)
  if (userIds.length === 0) return roles

  const [owners, mods] = await Promise.all([
    prisma.channel.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true },
    }),
    prisma.channelModerator.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true },
      distinct: ['userId'],
    }),
  ])

  for (const m of mods) roles.set(m.userId, 'moderator')
  for (const o of owners) roles.set(o.userId, 'owner')
  return roles
}

/** @-mention / "start a conversation" autocomplete — matches username or display
 * name prefix, excludes the searcher themselves. */
export async function searchUsers(prisma: PrismaClient, query: string, excludeUserId: string) {
  const q = query.trim()
  if (q.length < 2) return []
  const users = await prisma.user.findMany({
    where: {
      id: { not: excludeUserId },
      ...availableUserWhere,
      // Nobody the searcher blocked, and nobody who blocked the searcher.
      blocksReceived: { none: { blockerUserId: excludeUserId } },
      blocksMade: { none: { blockedUserId: excludeUserId } },
      OR: [
        { username: { contains: q, mode: 'insensitive' } },
        { displayName: { contains: q, mode: 'insensitive' } },
      ],
    },
    select: participantSelect,
    orderBy: { username: 'asc' },
    take: 10,
  })
  return users.map((u) => serializeParticipant(u))
}

/** All conversations the user is part of, newest activity first, with an unread
 * count derived from the participant row's own lastReadAt (per-participant, not
 * per-conversation, so each side's read state is independent). */
export async function listConversations(prisma: PrismaClient, userId: string) {
  const memberships = await prisma.conversationParticipant.findMany({
    where: { userId },
    select: {
      conversationId: true,
      lastReadAt: true,
      conversation: {
        select: {
          id: true,
          updatedAt: true,
          participants: {
            where: { userId: { not: userId } },
            select: { user: { select: otherUserSelect } },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              body: true,
              createdAt: true,
              sender: { select: { username: true } },
            },
          },
        },
      },
    },
    orderBy: { conversation: { updatedAt: 'desc' } },
  })

  const otherIds = memberships
    .map((m) => m.conversation.participants[0]?.user.id)
    .filter((id): id is string => Boolean(id))

  const [unreadRows, roles] = await Promise.all([
    memberships.length > 0
      ? prisma.$queryRaw<{ conversationId: string; count: bigint }[]>`
          SELECT cp."conversationId" AS "conversationId", COUNT(m.id)::bigint AS "count"
          FROM engagement."ConversationParticipant" cp
          JOIN engagement."Message" m
            ON m."conversationId" = cp."conversationId"
            AND m."senderId" != cp."userId"
            AND (cp."lastReadAt" IS NULL OR m."createdAt" > cp."lastReadAt")
          WHERE cp."userId" = ${userId}
          GROUP BY cp."conversationId"
        `
      : Promise.resolve([]),
    resolveChannelStaffRoles(prisma, otherIds),
  ])
  const unreadByConversation = new Map(unreadRows.map((r) => [r.conversationId, Number(r.count)]))

  return memberships
    .map((m) => {
      const other = m.conversation.participants[0]?.user
      if (!other) return null
      const last = m.conversation.messages[0]
      return {
        id: m.conversation.id,
        otherUser: serializeOtherUser(other, roles.get(other.id) ?? null),
        lastMessage: last
          ? {
              body: last.body,
              senderUsername: last.sender.username,
              createdAt: last.createdAt.toISOString(),
            }
          : null,
        unreadCount: unreadByConversation.get(m.conversationId) ?? 0,
        updatedAt: m.conversation.updatedAt.toISOString(),
      }
    })
    .filter((c): c is NonNullable<typeof c> => c !== null)
}

/** Finds the existing 1:1 conversation between two users, or creates one. */
export async function findOrCreateConversation(
  prisma: PrismaClient,
  userId: string,
  otherUserId: string,
): Promise<string> {
  const existing = await prisma.conversation.findFirst({
    where: {
      AND: [
        { participants: { some: { userId } } },
        { participants: { some: { userId: otherUserId } } },
      ],
    },
    select: { id: true },
  })
  if (existing) return existing.id

  const created = await prisma.conversation.create({
    data: {
      participants: {
        create: [{ userId }, { userId: otherUserId }],
      },
    },
    select: { id: true },
  })
  return created.id
}

/** Resolves `?before=` to a Prisma page start: a message id in this
 * conversation pages from that message, anything else must be an ISO
 * date-time. Returns null when it is neither. */
async function resolveBefore(
  prisma: PrismaClient,
  conversationId: string,
  before: string,
): Promise<Pick<Prisma.MessageFindManyArgs, 'cursor' | 'skip' | 'where'> | null> {
  const anchor = await prisma.message.findFirst({
    where: { id: before, conversationId },
    select: { id: true },
  })
  if (anchor) return { cursor: { id: anchor.id }, skip: 1 }
  const at = new Date(before)
  if (!/^\d{4}-\d{2}-\d{2}T/.test(before) || Number.isNaN(at.getTime())) return null
  return { where: { createdAt: { lt: at } } }
}

/** One page of a conversation, newest `limit` messages before `before`
 * (or the newest overall), returned oldest first. Viewing the newest page
 * marks the conversation read. */
export async function getConversationDetail(
  prisma: PrismaClient,
  userId: string,
  conversationId: string,
  page: { before?: string; limit?: number } = {},
) {
  const membership = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  })
  if (!membership) return { status: 'not_found' as const }

  const limit = page.limit ?? CONVERSATION_PAGE_LIMIT
  const start = page.before ? await resolveBefore(prisma, conversationId, page.before) : {}
  if (!start) return { status: 'invalid_before' as const }

  const [conversation, newestFirstPlusOne] = await Promise.all([
    prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        participants: {
          where: { userId: { not: userId } },
          select: { user: { select: otherUserSelect } },
        },
      },
    }),
    prisma.message.findMany({
      ...start,
      where: { ...start.where, conversationId },
      // id breaks createdAt ties so a page boundary never skips or repeats a message.
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      select: {
        id: true,
        body: true,
        createdAt: true,
        senderId: true,
        sender: { select: participantSelect },
      },
    }),
  ])
  if (!conversation) return { status: 'not_found' as const }
  const other = conversation.participants[0]?.user
  if (!other) return { status: 'not_found' as const }
  const hasMore = newestFirstPlusOne.length > limit
  const messages = newestFirstPlusOne.slice(0, limit).reverse()

  const roleUserIds = Array.from(new Set([other.id, ...messages.map((m) => m.senderId)]))
  const roles = await resolveChannelStaffRoles(prisma, roleUserIds)

  if (!page.before) {
    await prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadAt: new Date() },
    })
  }

  return {
    status: 'ok' as const,
    detail: {
      id: conversation.id,
      otherUser: serializeOtherUser(other, roles.get(other.id) ?? null),
      messages: messages.map((m) => ({
        id: m.id,
        senderUsername: m.sender.username,
        senderDisplayName: userName(m.sender),
        senderAvatarUrl: m.sender.avatarUrl,
        body: m.body,
        createdAt: m.createdAt.toISOString(),
        isMine: m.senderId === userId,
        senderChannelRole: roles.get(m.senderId) ?? null,
      })),
      hasMore,
    },
  }
}

/** Sends a message and notifies every other participant. Returns
 * `not_found` if the sender isn't a participant of this conversation and
 * `recipient_unavailable` if another participant was deleted or suspended. */
export async function sendMessage(
  prisma: PrismaClient,
  sender: { id: string; username: string; displayName: string; avatarUrl: string | null },
  conversationId: string,
  body: string,
) {
  const membership = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId: sender.id } },
  })
  if (!membership) return { status: 'not_found' as const }

  const unavailableRecipient = await prisma.conversationParticipant.findFirst({
    where: {
      conversationId,
      userId: { not: sender.id },
      user: { NOT: availableUserWhere },
    },
    select: { userId: true },
  })
  if (unavailableRecipient) return { status: 'recipient_unavailable' as const }

  // A block in either direction closes the thread. The sender gets the same
  // answer as for an unavailable account, so a block is not announced.
  const recipients = await prisma.conversationParticipant.findMany({
    where: { conversationId, userId: { not: sender.id } },
    select: { userId: true },
  })
  const blocked = await prisma.userBlock.findFirst({
    where: {
      OR: recipients.flatMap((recipient) => [
        { blockerUserId: sender.id, blockedUserId: recipient.userId },
        { blockerUserId: recipient.userId, blockedUserId: sender.id },
      ]),
    },
    select: { blockerUserId: true },
  })
  if (blocked) return { status: 'recipient_unavailable' as const }

  const [message] = await prisma.$transaction([
    prisma.message.create({
      data: { conversationId, senderId: sender.id, body },
      select: { id: true, body: true, createdAt: true },
    }),
    prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    }),
  ])

  const others = await prisma.conversationParticipant.findMany({
    where: { conversationId, userId: { not: sender.id } },
    select: { userId: true },
  })
  await Promise.all(
    others.map((p) =>
      notifyUserOfNewMessage(prisma, p.userId, withSafeName(sender), conversationId, body),
    ),
  )

  const roles = await resolveChannelStaffRoles(prisma, [sender.id])

  return {
    status: 'sent' as const,
    message: {
      id: message.id,
      senderUsername: sender.username,
      senderDisplayName: userName(sender),
      senderAvatarUrl: sender.avatarUrl,
      body: message.body,
      createdAt: message.createdAt.toISOString(),
      isMine: true,
      senderChannelRole: roles.get(sender.id) ?? null,
    },
  }
}
