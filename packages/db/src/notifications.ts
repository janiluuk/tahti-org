// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@prisma/client'

/** Fan out a NEW_POST notification to everyone following the artist. Called both
 * synchronously (immediate-publish posts, from the API) and from the worker's
 * post-publish-notify cron (scheduled posts crossing their publishAt). */
export async function notifyFollowersOfNewPost(
  prisma: PrismaClient,
  artist: { id: string; username: string; displayName: string },
  post: { title: string | null; body: string },
): Promise<void> {
  const followers = await prisma.artistFollow.findMany({
    where: { artistUserId: artist.id },
    select: { followerUserId: true },
  })
  if (followers.length === 0) return

  const title = `${artist.displayName} posted an update`
  const body = post.title || post.body.slice(0, 140)
  const url = `/u/${artist.username}`

  await prisma.notification.createMany({
    data: followers.map((f) => ({
      userId: f.followerUserId,
      type: 'NEW_POST' as const,
      actorUserId: artist.id,
      title,
      body,
      url,
    })),
  })
}

/** M38: notify a conversation participant that a new direct message arrived. */
export async function notifyUserOfNewMessage(
  prisma: PrismaClient,
  recipientUserId: string,
  sender: { id: string; username: string; displayName: string },
  conversationId: string,
  messageBody: string,
): Promise<void> {
  await prisma.notification.create({
    data: {
      userId: recipientUserId,
      type: 'NEW_MESSAGE',
      actorUserId: sender.id,
      title: `${sender.displayName} sent you a message`,
      body: messageBody.slice(0, 140),
      url: `/dashboard/messages/${conversationId}`,
    },
  })
}

export async function processScheduledPostNotifications(
  prisma: PrismaClient,
): Promise<{ notified: number }> {
  const due = await prisma.artistPost.findMany({
    where: { notifiedAt: null, publishAt: { lte: new Date() } },
    select: {
      id: true,
      title: true,
      body: true,
      user: { select: { id: true, username: true, displayName: true } },
    },
  })

  for (const post of due) {
    await notifyFollowersOfNewPost(prisma, post.user, post)
    await prisma.artistPost.update({
      where: { id: post.id },
      data: { notifiedAt: new Date() },
    })
  }

  return { notified: due.length }
}
