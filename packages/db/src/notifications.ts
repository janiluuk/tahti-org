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

/** Channel live chat @mention — in-app bell + deep link to the channel. */
export async function notifyUsersOfChatMention(
  prisma: PrismaClient,
  recipientUserIds: string[],
  mentioner: { id: string; username: string; displayName: string },
  channelSlug: string,
  messageBody: string,
): Promise<void> {
  if (recipientUserIds.length === 0) return
  await prisma.notification.createMany({
    data: recipientUserIds.map((userId) => ({
      userId,
      type: 'CHAT_MENTION' as const,
      actorUserId: mentioner.id,
      title: `${mentioner.displayName} mentioned you in chat`,
      body: messageBody.slice(0, 140),
      url: `/c/${channelSlug}`,
    })),
  })
}

/** Board rejected a Tahti Radio submission with a note — silent when note empty. */
export async function notifyArtistOfRadioSubmissionRejected(
  prisma: PrismaClient,
  artistUserId: string,
  trackTitle: string,
  rejectionNote: string,
): Promise<void> {
  const note = rejectionNote.trim()
  if (!note) return
  await prisma.notification.create({
    data: {
      userId: artistUserId,
      type: 'RADIO_SUBMISSION_REJECTED',
      title: `"${trackTitle}" was not added to Tahti Radio`,
      body: note.slice(0, 500),
      url: '/dashboard/settings/distribution',
    },
  })
}

/** Theme review lifecycle — all three are sticky (must be explicitly dismissed
 * in the dashboard's StickyNotificationBanner, not just cleared by opening
 * the ordinary notification bell). */
export async function notifyUserThemeUnderReview(
  prisma: PrismaClient,
  userId: string,
  theme: { id: string; name: string },
): Promise<void> {
  await prisma.notification.create({
    data: {
      userId,
      type: 'THEME_UNDER_REVIEW',
      title: `"${theme.name}" is in review`,
      body: 'An admin will approve or reject it soon.',
      url: '/dashboard/settings/themes',
      sticky: true,
    },
  })
}

export async function notifyUserThemeApproved(
  prisma: PrismaClient,
  userId: string,
  theme: { id: string; name: string },
): Promise<void> {
  await prisma.notification.create({
    data: {
      userId,
      type: 'THEME_APPROVED',
      title: `"${theme.name}" was approved`,
      body: 'Opening a pull request to publish it now.',
      url: '/dashboard/settings/themes',
      sticky: true,
    },
  })
}

export async function notifyUserThemeRejected(
  prisma: PrismaClient,
  userId: string,
  theme: { id: string; name: string },
  moderationNote: string,
): Promise<void> {
  await prisma.notification.create({
    data: {
      userId,
      type: 'THEME_REJECTED',
      title: `"${theme.name}" was rejected`,
      body: moderationNote.slice(0, 500),
      url: '/dashboard/settings/themes',
      sticky: true,
    },
  })
}

/** Fans out to every board member when apps/worker's missed-live-show-scan
 * cron flags a ScheduledLiveShow — see MissedLiveShowFlag in schema.prisma.
 * Deep-links to the admin queue list (there's no per-flag detail page — the
 * list itself carries the inspect/message/status actions), not the artist's
 * own dashboard.
 *
 * `boardMemberIds` lets a caller looping over several shows in one pass
 * (the scan job) fetch the board roster once instead of re-querying it per
 * show — omit it to have this function look the roster up itself for a
 * single one-off call. */
export async function notifyBoardOfMissedLiveShow(
  prisma: PrismaClient,
  show: { id: string; title: string; startAt: Date },
  artistDisplayName: string,
  boardMemberIds?: string[],
): Promise<void> {
  const ids =
    boardMemberIds ??
    (await prisma.user.findMany({ where: { isBoard: true }, select: { id: true } })).map(
      (m) => m.id,
    )
  if (ids.length === 0) return

  await prisma.notification.createMany({
    data: ids.map((userId) => ({
      userId,
      type: 'MISSED_LIVE_SHOW_FLAGGED' as const,
      title: `${artistDisplayName} missed a scheduled show`,
      body: `"${show.title}" was scheduled for ${show.startAt.toLocaleString()} but never went live.`,
      url: '/admin/missed-shows',
    })),
  })
}

/** One-off notification an admin sends from /admin/news's test-notification form. */
export async function notifyUserAdminTest(
  prisma: PrismaClient,
  userId: string,
  input: { title: string; body?: string; url?: string },
): Promise<void> {
  await prisma.notification.create({
    data: {
      userId,
      type: 'ADMIN_TEST',
      title: input.title,
      body: input.body ?? null,
      url: input.url ?? null,
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
