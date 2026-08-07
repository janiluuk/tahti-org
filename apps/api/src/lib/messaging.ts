// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'
import { notifyUserOfNewMessage } from '@tahti/db'

export type ChannelStaffRole = 'owner' | 'moderator'

const participantSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
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
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    channelRole,
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
            select: { user: { select: participantSelect } },
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
        otherUser: serializeParticipant(other, roles.get(other.id) ?? null),
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

export async function getConversationDetail(
  prisma: PrismaClient,
  userId: string,
  conversationId: string,
) {
  const membership = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  })
  if (!membership) return null

  const [conversation, messages] = await Promise.all([
    prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        participants: {
          where: { userId: { not: userId } },
          select: { user: { select: participantSelect } },
        },
      },
    }),
    prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: 200,
      select: {
        id: true,
        body: true,
        createdAt: true,
        senderId: true,
        sender: { select: participantSelect },
      },
    }),
  ])
  if (!conversation) return null
  const other = conversation.participants[0]?.user
  if (!other) return null

  const roleUserIds = Array.from(new Set([other.id, ...messages.map((m) => m.senderId)]))
  const roles = await resolveChannelStaffRoles(prisma, roleUserIds)

  await prisma.conversationParticipant.update({
    where: { conversationId_userId: { conversationId, userId } },
    data: { lastReadAt: new Date() },
  })

  return {
    id: conversation.id,
    otherUser: serializeParticipant(other, roles.get(other.id) ?? null),
    messages: messages.map((m) => ({
      id: m.id,
      senderUsername: m.sender.username,
      senderDisplayName: m.sender.displayName,
      senderAvatarUrl: m.sender.avatarUrl,
      body: m.body,
      createdAt: m.createdAt.toISOString(),
      isMine: m.senderId === userId,
      senderChannelRole: roles.get(m.senderId) ?? null,
    })),
  }
}

/** Sends a message and notifies every other participant. Returns null if the
 * sender isn't actually a participant of this conversation. */
export async function sendMessage(
  prisma: PrismaClient,
  sender: { id: string; username: string; displayName: string; avatarUrl: string | null },
  conversationId: string,
  body: string,
) {
  const membership = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId: sender.id } },
  })
  if (!membership) return null

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
    others.map((p) => notifyUserOfNewMessage(prisma, p.userId, sender, conversationId, body)),
  )

  const roles = await resolveChannelStaffRoles(prisma, [sender.id])

  return {
    id: message.id,
    senderUsername: sender.username,
    senderDisplayName: sender.displayName,
    senderAvatarUrl: sender.avatarUrl,
    body: message.body,
    createdAt: message.createdAt.toISOString(),
    isMine: true,
    senderChannelRole: roles.get(sender.id) ?? null,
  }
}
