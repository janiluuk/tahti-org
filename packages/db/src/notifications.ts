// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@prisma/client'
import { actorDisplayName } from './display-name.js'

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

  const title = `${actorDisplayName(artist)} posted an update`
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
 * track/set goes public (Sound.isPublic flips false -> true). */
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
      title: `${actorDisplayName(artist)} shared a new track`,
      body: item.title,
      url: `/u/${artist.username}`,
    })),
  })
}

const LIVE_NOTIFY_COOLDOWN_MS = 30 * 60_000

/** Fan out a CHANNEL_LIVE notification to everyone following the artist when
 * they go live. Skipped if this artist already sent one in the last 30
 * minutes, so a dropped stream that comes straight back doesn't ping everyone
 * twice. */
export async function notifyFollowersOfLiveChannel(
  prisma: PrismaClient,
  artist: { id: string; username: string; displayName: string },
  channel: { slug: string },
  now: Date = new Date(),
): Promise<void> {
  const recent = await prisma.notification.findFirst({
    where: {
      actorUserId: artist.id,
      type: 'CHANNEL_LIVE',
      createdAt: { gte: new Date(now.getTime() - LIVE_NOTIFY_COOLDOWN_MS) },
    },
    select: { id: true },
  })
  if (recent) return

  const followers = await prisma.artistFollow.findMany({
    where: { artistUserId: artist.id },
    select: { followerUserId: true },
  })
  if (followers.length === 0) return

  await prisma.notification.createMany({
    data: followers.map((f) => ({
      userId: f.followerUserId,
      type: 'CHANNEL_LIVE' as const,
      actorUserId: artist.id,
      title: `${actorDisplayName(artist)} is live`,
      body: null,
      url: `/c/${channel.slug}`,
      createdAt: now,
    })),
  })
}

/** Fan out a NEW_EVENT notification to everyone following the artist when
 * they add an upcoming event (events already in the past tell nobody). */
export async function notifyFollowersOfNewEvent(
  prisma: PrismaClient,
  artist: { id: string; username: string; displayName: string },
  event: { title: string; place: string; location: string; startAt: Date },
  now: Date = new Date(),
): Promise<void> {
  if (event.startAt <= now) return
  const followers = await prisma.artistFollow.findMany({
    where: { artistUserId: artist.id },
    select: { followerUserId: true },
  })
  if (followers.length === 0) return

  await prisma.notification.createMany({
    data: followers.map((f) => ({
      userId: f.followerUserId,
      type: 'NEW_EVENT' as const,
      actorUserId: artist.id,
      title: `${actorDisplayName(artist)} announced an event`,
      body: `${event.title} · ${event.place}, ${event.location}`,
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
      title: `${actorDisplayName(artist)} released "${release.title}"`,
      body: null,
      url: `/r/${release.smartLinkSlug}`,
    })),
  })
}

const REPEAT_QUIET_MS = 24 * 60 * 60 * 1000

/** True when this person already triggered the same notification for the same
 * thing within a day. Following, loving and reposting can all be undone and
 * done again, and each round used to notify the artist afresh, which made
 * the toggle a way to flood someone's inbox. */
async function alreadyToldToday(
  prisma: PrismaClient,
  match: {
    userId: string
    actorUserId: string
    type: 'NEW_FOLLOWER' | 'NEW_LIKE' | 'NEW_REPOST'
    url: string
  },
  now: Date = new Date(),
): Promise<boolean> {
  const recent = await prisma.notification.findFirst({
    where: { ...match, createdAt: { gte: new Date(now.getTime() - REPEAT_QUIET_MS) } },
    select: { id: true },
  })
  return recent !== null
}

/** M40: notify an artist that someone followed them. */
export async function notifyArtistOfNewFollower(
  prisma: PrismaClient,
  artistUserId: string,
  follower: { id: string; username: string; displayName: string },
): Promise<void> {
  if (
    await alreadyToldToday(prisma, {
      userId: artistUserId,
      actorUserId: follower.id,
      type: 'NEW_FOLLOWER',
      url: `/u/${follower.username}`,
    })
  ) {
    return
  }
  await prisma.notification.create({
    data: {
      userId: artistUserId,
      type: 'NEW_FOLLOWER',
      actorUserId: follower.id,
      title: `${actorDisplayName(follower)} followed you`,
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
  if (
    await alreadyToldToday(prisma, {
      userId: artistUserId,
      actorUserId: liker.id,
      type: 'NEW_LIKE',
      url: `/t/${item.id}`,
    })
  ) {
    return
  }
  await prisma.notification.create({
    data: {
      userId: artistUserId,
      type: 'NEW_LIKE',
      actorUserId: liker.id,
      title: `${actorDisplayName(liker)} loved "${item.title}"`,
      body: null,
      url: `/t/${item.id}`,
    },
  })
}

/** Notify an artist that someone commented on one of their tracks (`item`
 * set) or on their channel — never for their own comments. */
export async function notifyArtistOfNewComment(
  prisma: PrismaClient,
  artistUserId: string,
  commenter: { id: string; username: string; displayName: string },
  comment: { body: string },
  target: { channelSlug: string; item?: { id: string; title: string } },
): Promise<void> {
  if (artistUserId === commenter.id) return
  await prisma.notification.create({
    data: {
      userId: artistUserId,
      type: 'NEW_COMMENT',
      actorUserId: commenter.id,
      title: target.item
        ? `${actorDisplayName(commenter)} commented on "${target.item.title}"`
        : `${actorDisplayName(commenter)} commented on your channel`,
      body: comment.body.slice(0, 140),
      url: target.item ? `/t/${target.item.id}` : `/c/${target.channelSlug}`,
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
  if (
    await alreadyToldToday(prisma, {
      userId: artistUserId,
      actorUserId: reposter.id,
      type: 'NEW_REPOST',
      url: `/t/${item.id}`,
    })
  ) {
    return
  }
  await prisma.notification.create({
    data: {
      userId: artistUserId,
      type: 'NEW_REPOST',
      actorUserId: reposter.id,
      title: `${actorDisplayName(reposter)} reposted "${item.title}"`,
      body: null,
      url: `/t/${item.id}`,
    },
  })
}

/** Notify a playlist's owner, everyone who has previously contributed a
 * track to it ("participants") and its subscribers (while it is public or
 * unlisted) when someone adds a new one — never notifies
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
  adder: { id: string; username: string; displayName: string },
  item: { title: string },
): Promise<void> {
  const priorContributors = await prisma.collectionItem.findMany({
    where: { collectionId: collection.id, addedByUserId: { not: null } },
    select: { addedByUserId: true },
    distinct: ['addedByUserId'],
  })

  // Subscribers only hear about collections they can still open.
  const subscribers = await prisma.collectionSubscription.findMany({
    where: {
      collectionId: collection.id,
      collection: { OR: [{ isPublic: true }, { visibility: 'UNLISTED' }] },
    },
    select: { userId: true },
  })

  const recipients = new Set<string>()
  if (collection.ownerUserId !== adder.id) recipients.add(collection.ownerUserId)
  for (const c of priorContributors) {
    if (c.addedByUserId && c.addedByUserId !== adder.id) recipients.add(c.addedByUserId)
  }
  for (const s of subscribers) {
    if (s.userId !== adder.id) recipients.add(s.userId)
  }
  if (recipients.size === 0) return

  const title = `${actorDisplayName(adder)} added "${item.title}" to ${collection.name}`
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
      title: `${actorDisplayName(sender)} sent you a message`,
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
      title: `${actorDisplayName(mentioner)} mentioned you in chat`,
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
      url: '/studio/channel?tab=tahti-radio',
    },
  })
}

/** Theme review lifecycle — all three are sticky (must be explicitly
 * acknowledged; opening the bell / read-all does not clear them). */
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

/** Sent when a lossless upload's compressed streaming copy finishes
 * encoding — see Sound.streamingCopyStatus. The item was already
 * READY (playable off its FLAC) before this fires. */
export async function notifyArtistStreamingCopyReady(
  prisma: PrismaClient,
  artistUserId: string,
  item: { id: string; title: string },
): Promise<void> {
  await prisma.notification.create({
    data: {
      userId: artistUserId,
      type: 'STREAMING_COPY_READY',
      title: `"${item.title}" is ready for low-bandwidth streaming`,
      body: "A compressed copy was encoded for listeners on slower connections or clients that can't play FLAC.",
      url: `/dashboard/sound/${item.id}`,
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
  artist: { username: string; displayName: string },
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
      title: `${actorDisplayName(artist)} missed a scheduled show`,
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
