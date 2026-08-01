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

/** Fan out a NEW_TRACK notification to everyone following the artist, when a
 * track/set goes public (ArchiveItem.isPublic flips false -> true). */
export async function notifyFollowersOfNewTrack(
  prisma: PrismaClient,
  artist: { id: string; username: string; displayName: string },
  item: { id: string; title: string },
): Promise<void> {
  const followers = await prisma.artistFollow.findMany({
    where: { artistUserId: artist.id },
    select: { followerUserId: true },
  })
  if (followers.length === 0) return

  await prisma.notification.createMany({
    data: followers.map((f) => ({
      userId: f.followerUserId,
      type: 'NEW_TRACK' as const,
      actorUserId: artist.id,
      title: `${artist.displayName} shared a new track`,
      body: item.title,
      url: `/u/${artist.username}`,
    })),
  })
}

/** Fan out a NEW_RELEASE notification when a Tahti Radio–opted-in artist
 * publishes a release — callers must check `!channel.metaStreamOptOut` first. */
export async function notifyFollowersOfNewRelease(
  prisma: PrismaClient,
  artist: { id: string; username: string; displayName: string },
  release: { title: string; smartLinkSlug: string },
): Promise<void> {
  const followers = await prisma.artistFollow.findMany({
    where: { artistUserId: artist.id },
    select: { followerUserId: true },
  })
  if (followers.length === 0) return

  await prisma.notification.createMany({
    data: followers.map((f) => ({
      userId: f.followerUserId,
      type: 'NEW_RELEASE' as const,
      actorUserId: artist.id,
      title: `${artist.displayName} released "${release.title}"`,
      body: null,
      url: `/r/${release.smartLinkSlug}`,
    })),
  })
}

/** M40: notify an artist that someone followed them. */
export async function notifyArtistOfNewFollower(
  prisma: PrismaClient,
  artistUserId: string,
  follower: { id: string; username: string; displayName: string },
): Promise<void> {
  await prisma.notification.create({
    data: {
      userId: artistUserId,
      type: 'NEW_FOLLOWER',
      actorUserId: follower.id,
      title: `${follower.displayName} followed you`,
      body: `@${follower.username}`,
      url: `/u/${follower.username}`,
    },
  })
}

/** M40: notify an artist that someone loved one of their tracks. */
export async function notifyArtistOfNewLike(
  prisma: PrismaClient,
  artistUserId: string,
  liker: { id: string; username: string; displayName: string },
  item: { id: string; title: string; channelSlug: string },
): Promise<void> {
  if (artistUserId === liker.id) return
  await prisma.notification.create({
    data: {
      userId: artistUserId,
      type: 'NEW_LIKE',
      actorUserId: liker.id,
      title: `${liker.displayName} loved "${item.title}"`,
      body: null,
      url: `/c/${item.channelSlug}`,
    },
  })
}

/** Notify an artist that someone reposted/shared one of their tracks. */
export async function notifyArtistOfNewRepost(
  prisma: PrismaClient,
  artistUserId: string,
  reposter: { id: string; username: string; displayName: string },
  item: { id: string; title: string; channelSlug: string },
): Promise<void> {
  if (artistUserId === reposter.id) return
  await prisma.notification.create({
    data: {
      userId: artistUserId,
      type: 'NEW_REPOST',
      actorUserId: reposter.id,
      title: `${reposter.displayName} reposted "${item.title}"`,
      body: null,
      url: `/c/${item.channelSlug}`,
    },
  })
}

/** Notify a playlist's owner and everyone who has previously contributed a
 * track to it ("participants") when someone adds a new one — never notifies
 * the person who just did the adding, and de-dupes owner/participants so
 * nobody gets pinged twice. */
export async function notifyPlaylistOfNewTrack(
  prisma: PrismaClient,
  collection: {
    id: string
    slug: string
    name: string
    ownerUsername: string
    ownerUserId: string
  },
  adder: { id: string; displayName: string },
  item: { title: string },
): Promise<void> {
  const priorContributors = await prisma.collectionItem.findMany({
    where: { collectionId: collection.id, addedByUserId: { not: null } },
    select: { addedByUserId: true },
    distinct: ['addedByUserId'],
  })

  const recipients = new Set<string>()
  if (collection.ownerUserId !== adder.id) recipients.add(collection.ownerUserId)
  for (const c of priorContributors) {
    if (c.addedByUserId && c.addedByUserId !== adder.id) recipients.add(c.addedByUserId)
  }
  if (recipients.size === 0) return

  const title = `${adder.displayName} added "${item.title}" to ${collection.name}`
  const url = `/u/${collection.ownerUsername}/c/${collection.slug}`

  await prisma.notification.createMany({
    data: [...recipients].map((userId) => ({
      userId,
      type: 'PLAYLIST_TRACK_ADDED' as const,
      actorUserId: adder.id,
      title,
      body: null,
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
