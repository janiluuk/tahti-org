// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@prisma/client'
import { availableUserWhere } from './available-user.js'
import { actorDisplayName } from './display-name.js'
import {
  accountRestrictionCopy,
  boardTrackEditCopy,
  channelLiveCopy,
  chatMentionCopy,
  contentReportedCopy,
  featureRequestUpdatedCopy,
  forcedOfflineCopy,
  missedLiveShowCopy,
  newCommentCopy,
  newEventCopy,
  newFollowerCopy,
  newLikeCopy,
  newMessageCopy,
  newPostCopy,
  newReleaseCopy,
  newRepostCopy,
  newTrackCopy,
  playlistTrackAddedCopy,
  radioInclusionCopy,
  radioSubmissionAcceptedCopy,
  radioSubmissionRejectedCopy,
  resolveNotificationLocale,
  selectsPickCopy,
  stationReviewCopy,
  streamingCopyReadyCopy,
  supportTicketCopy,
  themeApprovedCopy,
  themeRejectedCopy,
  themeUnderReviewCopy,
  venueShowBookedCopy,
  venueShowCanceledCopy,
  venueVerifiedCopy,
  type NotificationLocale,
} from './notification-copy.js'

/** The artist's followers who can still receive a notification: deleted and
 * suspended accounts are left out, so a fan-out never writes rows nobody
 * will read. */
function followersToNotify(prisma: PrismaClient, artistUserId: string) {
  return prisma.artistFollow.findMany({
    where: { artistUserId, follower: availableUserWhere },
    select: { followerUserId: true, follower: { select: { uiLocale: true } } },
  })
}

async function localeFor(prisma: PrismaClient, userId: string): Promise<NotificationLocale> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { uiLocale: true } })
  return resolveNotificationLocale(u?.uiLocale)
}

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

/** Fan out a NEW_POST notification to everyone following the artist. Called both
 * synchronously (immediate-publish posts, from the API) and from the worker's
 * post-publish-notify cron (scheduled posts crossing their publishAt). */
export async function notifyFollowersOfNewPost(
  prisma: PrismaClient,
  artist: { id: string; username: string; displayName: string },
  post: { title: string | null; body: string },
): Promise<void> {
  const followers = await followersToNotify(prisma, artist.id)
  if (followers.length === 0) return

  const name = actorDisplayName(artist)
  const url = `/u/${artist.username}`

  await prisma.notification.createMany({
    data: followers.map((f) => {
      const copy = newPostCopy(resolveNotificationLocale(f.follower.uiLocale), name, post)
      return {
        userId: f.followerUserId,
        type: 'NEW_POST' as const,
        actorUserId: artist.id,
        title: copy.title,
        body: copy.body,
        url,
      }
    }),
  })
}

/** Tells a venue's owner an artist put a show on the venue's calendar, which
 * they otherwise only find by opening the venue page. Silent when the owner
 * books their own venue. */
export async function notifyVenueOwnerOfShow(
  prisma: PrismaClient,
  show: {
    venue: { name: string; createdBy: string }
    artistUserId: string
    startAt: Date
  },
): Promise<void> {
  if (show.venue.createdBy === show.artistUserId) return
  const [owner, artist] = await Promise.all([
    prisma.user.findFirst({
      where: { id: show.venue.createdBy, ...availableUserWhere },
      select: { id: true, uiLocale: true },
    }),
    prisma.user.findUnique({
      where: { id: show.artistUserId },
      select: { username: true, displayName: true },
    }),
  ])
  if (!owner || !artist) return
  const copy = venueShowBookedCopy(
    resolveNotificationLocale(owner.uiLocale),
    actorDisplayName(artist),
    show.venue.name,
    show.startAt,
  )
  await prisma.notification.create({
    data: {
      userId: owner.id,
      type: 'VENUE_SHOW_BOOKED',
      actorUserId: show.artistUserId,
      title: copy.title,
      body: copy.body,
      url: '/venues/mine',
    },
  })
}

/** Fan out a NEW_TRACK notification to everyone following the artist, the
 * first time a track/set goes public. The notification opens the track. */
export async function notifyFollowersOfNewTrack(
  prisma: PrismaClient,
  artist: { id: string; username: string; displayName: string },
  item: { id: string; title: string },
): Promise<void> {
  const url = `/t/${item.id}`
  // Announced once per track. Without this check, taking a track private
  // and public again pinged every follower each time.
  const announced = await prisma.notification.findFirst({
    where: { type: 'NEW_TRACK', actorUserId: artist.id, url },
    select: { id: true },
  })
  if (announced) return

  const followers = await followersToNotify(prisma, artist.id)
  if (followers.length === 0) return

  const name = actorDisplayName(artist)
  await prisma.notification.createMany({
    data: followers.map((f) => {
      const copy = newTrackCopy(resolveNotificationLocale(f.follower.uiLocale), name, item.title)
      return {
        userId: f.followerUserId,
        type: 'NEW_TRACK' as const,
        actorUserId: artist.id,
        title: copy.title,
        body: copy.body,
        url,
      }
    }),
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

  const followers = await followersToNotify(prisma, artist.id)
  if (followers.length === 0) return

  const name = actorDisplayName(artist)
  const url = `/c/${channel.slug}`
  await prisma.notification.createMany({
    data: followers.map((f) => {
      const copy = channelLiveCopy(resolveNotificationLocale(f.follower.uiLocale), name)
      return {
        userId: f.followerUserId,
        type: 'CHANNEL_LIVE' as const,
        actorUserId: artist.id,
        title: copy.title,
        body: copy.body,
        url,
        createdAt: now,
      }
    }),
  })
}

/** A show at a venue was called off: whichever side didn't cancel it (the
 * booked artist or the venue's owner) is told. */
export async function notifyOfCanceledVenueShow(
  prisma: PrismaClient,
  show: {
    venue: { name: string; createdBy: string }
    artistUserId: string
    startAt: Date
    canceledBy: string
  },
): Promise<void> {
  const byVenue = show.canceledBy === show.venue.createdBy
  const recipientId = byVenue ? show.artistUserId : show.venue.createdBy
  if (recipientId === show.canceledBy) return
  const [recipient, actor] = await Promise.all([
    prisma.user.findFirst({
      where: { id: recipientId, ...availableUserWhere },
      select: { id: true, uiLocale: true },
    }),
    prisma.user.findUnique({
      where: { id: show.canceledBy },
      select: { username: true, displayName: true },
    }),
  ])
  if (!recipient || !actor) return
  const copy = venueShowCanceledCopy(
    resolveNotificationLocale(recipient.uiLocale),
    byVenue,
    show.venue.name,
    actorDisplayName(actor),
    show.startAt,
  )
  await prisma.notification.create({
    data: {
      userId: recipient.id,
      type: 'VENUE_SHOW_CANCELED',
      actorUserId: show.canceledBy,
      title: copy.title,
      body: copy.body,
      url: byVenue ? '/venues' : '/venues/mine',
    },
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
  const followers = await followersToNotify(prisma, artist.id)
  if (followers.length === 0) return

  const name = actorDisplayName(artist)
  const url = `/u/${artist.username}`
  await prisma.notification.createMany({
    data: followers.map((f) => {
      const copy = newEventCopy(resolveNotificationLocale(f.follower.uiLocale), name, event)
      return {
        userId: f.followerUserId,
        type: 'NEW_EVENT' as const,
        actorUserId: artist.id,
        title: copy.title,
        body: copy.body,
        url,
      }
    }),
  })
}

/** Fan out a NEW_RELEASE notification when a Tahti Radio–opted-in artist
 * publishes a release — callers must check `!channel.metaStreamOptOut` first. */
export async function notifyFollowersOfNewRelease(
  prisma: PrismaClient,
  artist: { id: string; username: string; displayName: string },
  release: { title: string; smartLinkSlug: string },
): Promise<void> {
  const followers = await followersToNotify(prisma, artist.id)
  if (followers.length === 0) return

  const name = actorDisplayName(artist)
  const url = `/r/${release.smartLinkSlug}`
  await prisma.notification.createMany({
    data: followers.map((f) => {
      const copy = newReleaseCopy(
        resolveNotificationLocale(f.follower.uiLocale),
        name,
        release.title,
      )
      return {
        userId: f.followerUserId,
        type: 'NEW_RELEASE' as const,
        actorUserId: artist.id,
        title: copy.title,
        body: copy.body,
        url,
      }
    }),
  })
}

/** True when either account has blocked the other. Someone you blocked can
 * still love or repost a public track, but you are not told about it. */
async function blockedEitherWay(
  prisma: PrismaClient,
  userId: string,
  otherUserId: string,
): Promise<boolean> {
  const block = await prisma.userBlock.findFirst({
    where: {
      OR: [
        { blockerUserId: userId, blockedUserId: otherUserId },
        { blockerUserId: otherUserId, blockedUserId: userId },
      ],
    },
    select: { blockerUserId: true },
  })
  return block !== null
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
  if (await blockedEitherWay(prisma, artistUserId, follower.id)) return
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
  const copy = newFollowerCopy(
    await localeFor(prisma, artistUserId),
    actorDisplayName(follower),
    follower.username,
  )
  await prisma.notification.create({
    data: {
      userId: artistUserId,
      type: 'NEW_FOLLOWER',
      actorUserId: follower.id,
      title: copy.title,
      body: copy.body,
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
  if (await blockedEitherWay(prisma, artistUserId, liker.id)) return
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
  const copy = newLikeCopy(
    await localeFor(prisma, artistUserId),
    actorDisplayName(liker),
    item.title,
  )
  await prisma.notification.create({
    data: {
      userId: artistUserId,
      type: 'NEW_LIKE',
      actorUserId: liker.id,
      title: copy.title,
      body: copy.body,
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
  const copy = newCommentCopy(
    await localeFor(prisma, artistUserId),
    actorDisplayName(commenter),
    comment.body,
    target.item?.title ?? null,
  )
  await prisma.notification.create({
    data: {
      userId: artistUserId,
      type: 'NEW_COMMENT',
      actorUserId: commenter.id,
      title: copy.title,
      body: copy.body,
      url: target.item ? `/t/${target.item.id}` : `/c/${target.channelSlug}`,
    },
  })
}

function fieldLabel(field: string): string {
  return field.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()
}

/** Tells an artist a board member changed a track's details from Admin →
 * Content, naming the fields, so an edit they didn't make isn't a mystery.
 * Silent when the board member edits their own track. */
export async function notifyArtistOfBoardTrackEdit(
  prisma: PrismaClient,
  edit: { soundId: string; channelId: string; title: string; fields: string[]; actorId: string },
): Promise<void> {
  if (edit.fields.length === 0) return
  const channel = await prisma.channel.findUnique({
    where: { id: edit.channelId },
    select: { userId: true },
  })
  if (!channel || channel.userId === edit.actorId) return
  const copy = boardTrackEditCopy(
    await localeFor(prisma, channel.userId),
    edit.title,
    edit.fields.map(fieldLabel).join(', '),
  )
  await prisma.notification.create({
    data: {
      userId: channel.userId,
      type: 'TRACK_EDITED_BY_BOARD',
      actorUserId: edit.actorId,
      title: copy.title,
      body: copy.body,
      url: `/studio/sounds/${edit.soundId}`,
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
  if (await blockedEitherWay(prisma, artistUserId, reposter.id)) return
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
  const copy = newRepostCopy(
    await localeFor(prisma, artistUserId),
    actorDisplayName(reposter),
    item.title,
  )
  await prisma.notification.create({
    data: {
      userId: artistUserId,
      type: 'NEW_REPOST',
      actorUserId: reposter.id,
      title: copy.title,
      body: copy.body,
      url: `/t/${item.id}`,
    },
  })
}

/** Tells an artist the board picked one of their tracks for the Tahti
 * Selects rotation. Bulk refills from the top-played list stay silent. */
export async function notifyArtistOfSelectsPick(
  prisma: PrismaClient,
  pick: { soundId: string; channelSlug: string },
): Promise<void> {
  const sound = await prisma.sound.findUnique({
    where: { id: pick.soundId },
    select: { title: true, channel: { select: { userId: true } } },
  })
  if (!sound) return
  const artist = await prisma.user.findFirst({
    where: { id: sound.channel.userId, ...availableUserWhere },
    select: { id: true, uiLocale: true },
  })
  if (!artist) return
  const copy = selectsPickCopy(resolveNotificationLocale(artist.uiLocale), sound.title)
  await prisma.notification.create({
    data: {
      userId: artist.id,
      type: 'TAHTI_SELECTS_PICK',
      title: copy.title,
      body: copy.body,
      url: `/c/${pick.channelSlug}`,
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

  // Nobody hears about an add from an account they blocked, or that blocked them.
  const blocks = await prisma.userBlock.findMany({
    where: {
      OR: [
        { blockerUserId: adder.id, blockedUserId: { in: [...recipients] } },
        { blockerUserId: { in: [...recipients] }, blockedUserId: adder.id },
      ],
    },
    select: { blockerUserId: true, blockedUserId: true },
  })
  for (const block of blocks) {
    recipients.delete(block.blockerUserId)
    recipients.delete(block.blockedUserId)
  }
  if (recipients.size === 0) return

  const url = `/u/${collection.ownerUsername}/c/${collection.slug}`
  const recipientIds = [...recipients]
  const locales = await localesFor(prisma, recipientIds)
  const name = actorDisplayName(adder)

  await prisma.notification.createMany({
    data: recipientIds.map((userId) => {
      const copy = playlistTrackAddedCopy(
        locales.get(userId) ?? 'en',
        name,
        item.title,
        collection.name,
      )
      return {
        userId,
        type: 'PLAYLIST_TRACK_ADDED' as const,
        actorUserId: adder.id,
        title: copy.title,
        body: copy.body,
        url,
      }
    }),
  })
}

/** Tells a venue's owner the board verified it (the badge shows on the venue
 * list) or took the verification back. */
export async function notifyVenueOwnerOfVerification(
  prisma: PrismaClient,
  venue: { name: string; createdBy: string },
  verified: boolean,
): Promise<void> {
  const owner = await prisma.user.findFirst({
    where: { id: venue.createdBy, ...availableUserWhere },
    select: { id: true, uiLocale: true },
  })
  if (!owner) return
  const copy = venueVerifiedCopy(resolveNotificationLocale(owner.uiLocale), venue.name, verified)
  await prisma.notification.create({
    data: {
      userId: owner.id,
      type: 'VENUE_VERIFIED',
      title: copy.title,
      body: copy.body,
      url: '/venues/mine',
    },
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
  const url = `/dashboard/messages/${conversationId}`
  const copy = newMessageCopy(
    await localeFor(prisma, recipientUserId),
    actorDisplayName(sender),
    messageBody,
  )

  // One unread notification per conversation: a second message while the
  // first is still unread refreshes it, instead of stacking a new bell entry
  // for every line someone types.
  const unread = await prisma.notification.findFirst({
    where: { userId: recipientUserId, type: 'NEW_MESSAGE', url, readAt: null },
    select: { id: true },
  })
  if (unread) {
    await prisma.notification.update({
      where: { id: unread.id },
      data: {
        actorUserId: sender.id,
        title: copy.title,
        body: copy.body,
        createdAt: new Date(),
      },
    })
    return
  }

  await prisma.notification.create({
    data: {
      userId: recipientUserId,
      type: 'NEW_MESSAGE',
      actorUserId: sender.id,
      title: copy.title,
      body: copy.body,
      url,
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
  const locales = await localesFor(prisma, recipientUserIds)
  const name = actorDisplayName(mentioner)
  const url = `/c/${channelSlug}`
  await prisma.notification.createMany({
    data: recipientUserIds.map((userId) => {
      const copy = chatMentionCopy(locales.get(userId) ?? 'en', name, messageBody)
      return {
        userId,
        type: 'CHAT_MENTION' as const,
        actorUserId: mentioner.id,
        title: copy.title,
        body: copy.body,
        url,
      }
    }),
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
  const copy = radioSubmissionRejectedCopy(await localeFor(prisma, artistUserId), trackTitle, note)
  await prisma.notification.create({
    data: {
      userId: artistUserId,
      type: 'RADIO_SUBMISSION_REJECTED',
      title: copy.title,
      body: copy.body,
      url: '/studio/channel?tab=tahti-radio',
    },
  })
}

/** Board added a submitted track to Tahti Radio's rotation. Says so when
 * the approval also made a private track public. */
export async function notifyArtistOfRadioSubmissionAccepted(
  prisma: PrismaClient,
  artistUserId: string,
  trackTitle: string,
  madePublic: boolean,
): Promise<void> {
  const copy = radioSubmissionAcceptedCopy(
    await localeFor(prisma, artistUserId),
    trackTitle,
    madePublic,
  )
  await prisma.notification.create({
    data: {
      userId: artistUserId,
      type: 'RADIO_SUBMISSION_ACCEPTED',
      title: copy.title,
      body: copy.body,
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
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { uiLocale: true },
  })
  const copy = themeUnderReviewCopy(resolveNotificationLocale(user?.uiLocale), theme.name)
  await prisma.notification.create({
    data: {
      userId,
      type: 'THEME_UNDER_REVIEW',
      title: copy.title,
      body: copy.body,
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
  const copy = streamingCopyReadyCopy(await localeFor(prisma, artistUserId), item.title)
  await prisma.notification.create({
    data: {
      userId: artistUserId,
      type: 'STREAMING_COPY_READY',
      title: copy.title,
      body: copy.body,
      url: `/dashboard/sound/${item.id}`,
    },
  })
}

/** Tells a channel's owner the board took the channel out of the Tahti Radio
 * rotation, or put it back, since it overrides the owner's own setting. */
export async function notifyOwnerOfRadioInclusion(
  prisma: PrismaClient,
  ownerUserId: string,
  included: boolean,
): Promise<void> {
  const copy = radioInclusionCopy(await localeFor(prisma, ownerUserId), included)
  await prisma.notification.create({
    data: {
      userId: ownerUserId,
      type: 'TAHTI_RADIO_INCLUSION_CHANGED',
      title: copy.title,
      body: copy.body,
      url: '/studio/channel?tab=tahti-radio',
    },
  })
}

export async function notifyUserThemeApproved(
  prisma: PrismaClient,
  userId: string,
  theme: { id: string; name: string },
): Promise<void> {
  const copy = themeApprovedCopy(await localeFor(prisma, userId), theme.name)
  await prisma.notification.create({
    data: {
      userId,
      type: 'THEME_APPROVED',
      title: copy.title,
      body: copy.body,
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
  const copy = themeRejectedCopy(await localeFor(prisma, userId), theme.name, moderationNote)
  await prisma.notification.create({
    data: {
      userId,
      type: 'THEME_REJECTED',
      title: copy.title,
      body: copy.body,
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

  const locales = await localesFor(prisma, ids)
  const name = actorDisplayName(artist)
  await prisma.notification.createMany({
    data: ids.map((userId) => {
      const copy = missedLiveShowCopy(locales.get(userId) ?? 'en', name, show.title, show.startAt)
      return {
        userId,
        type: 'MISSED_LIVE_SHOW_FLAGGED' as const,
        title: copy.title,
        body: copy.body,
        url: '/admin/missed-shows',
      }
    }),
  })
}

/** Tells whoever suggested an internet radio station what the board decided.
 * An accepted station starts switched off, so the notice doesn't promise it
 * is listed yet. */
export async function notifySubmitterOfStationReview(
  prisma: PrismaClient,
  suggestion: { submitterId: string | null; name: string },
  review: { approved: boolean; note: string | null },
): Promise<void> {
  if (!suggestion.submitterId) return
  const submitter = await prisma.user.findFirst({
    where: { id: suggestion.submitterId, ...availableUserWhere },
    select: { id: true, uiLocale: true },
  })
  if (!submitter) return
  const copy = stationReviewCopy(
    resolveNotificationLocale(submitter.uiLocale),
    suggestion.name,
    review.approved,
    review.note,
  )
  await prisma.notification.create({
    data: {
      userId: submitter.id,
      type: 'RADIO_STATION_REVIEWED',
      title: copy.title,
      body: copy.body,
      url: '/radio',
    },
  })
}

/** Tells the board about a new support request, or a requester's follow-up
 * on one, so tickets don't wait until someone opens Admin → Moderation.
 * The person who wrote it is never told about their own message. */
export async function notifyBoardOfSupportTicket(
  prisma: PrismaClient,
  ticket: { subject: string },
  kind: 'new' | 'reply',
  authorUserId?: string | null,
): Promise<void> {
  const board = await prisma.user.findMany({
    where: { isBoard: true, ...availableUserWhere },
    select: { id: true, uiLocale: true },
  })
  const members = board.filter((m) => m.id !== authorUserId)
  if (members.length === 0) return

  await prisma.notification.createMany({
    data: members.map((member) => {
      const copy = supportTicketCopy(
        resolveNotificationLocale(member.uiLocale),
        kind,
        ticket.subject,
      )
      return {
        userId: member.id,
        type: 'SUPPORT_TICKET' as const,
        title: copy.title,
        body: copy.body,
        url: '/admin/moderation/support',
      }
    }),
  })
}

/** Tells the board a new content report is waiting, so a copyright or
 * harassment report doesn't sit unseen in Admin → Moderation. Repeats from
 * the same reporter are folded before this is called. */
export async function notifyBoardOfContentReport(
  prisma: PrismaClient,
  report: { label: string; reason: string },
): Promise<void> {
  const board = await prisma.user.findMany({
    where: { isBoard: true, ...availableUserWhere },
    select: { id: true, uiLocale: true },
  })
  if (board.length === 0) return

  await prisma.notification.createMany({
    data: board.map((member) => {
      const copy = contentReportedCopy(
        resolveNotificationLocale(member.uiLocale),
        report.label,
        report.reason,
      )
      return {
        userId: member.id,
        type: 'CONTENT_REPORTED' as const,
        title: copy.title,
        body: copy.body,
        url: '/admin/moderation/content-reports',
      }
    }),
  })
}

/** Tells whoever proposed or voted for a feature request that the board
 * moved it (planned, in progress, done, declined, merged into another).
 * The board member who made the change, and unavailable accounts, are left
 * out. */
export async function notifyFeatureRequestFollowers(
  prisma: PrismaClient,
  request: { id: string; title: string; status: string; proposedById: string; actorId: string },
): Promise<void> {
  const voters = await prisma.featureRequestVote.findMany({
    where: { featureRequestId: request.id, user: availableUserWhere },
    select: { userId: true },
  })
  const proposer = await prisma.user.findFirst({
    where: { id: request.proposedById, ...availableUserWhere },
    select: { id: true },
  })
  const ids = new Set([...(proposer ? [proposer.id] : []), ...voters.map((v) => v.userId)])
  ids.delete(request.actorId)
  if (ids.size === 0) return

  const recipientIds = [...ids]
  const locales = await localesFor(prisma, recipientIds)
  await prisma.notification.createMany({
    data: recipientIds.map((userId) => {
      const copy = featureRequestUpdatedCopy(
        locales.get(userId) ?? 'en',
        request.status,
        request.title,
        userId === request.proposedById,
      )
      return {
        userId,
        type: 'FEATURE_REQUEST_UPDATED' as const,
        title: copy.title,
        body: copy.body,
        url: '/governance/feature-requests',
      }
    }),
  })
}

const RESTRICTION_URL = {
  UPLOAD: '/studio',
  LIVE_SHOW_BOOKING: '/studio/schedule',
} as const

/** Tells an account the board restricted (or lifted a restriction on) its
 * uploads or show bookings, with the board's reason. A sign-in ban signs the
 * account out, so it gets no notice. */
export async function notifyUserOfAccountRestriction(
  prisma: PrismaClient,
  userId: string,
  restriction: {
    type: 'LIVE_SHOW_BOOKING' | 'UPLOAD' | 'LOGIN'
    reason: string
    expiresAt: Date | null
    lifted: boolean
  },
): Promise<void> {
  if (restriction.type === 'LOGIN') return
  const copy = accountRestrictionCopy(
    await localeFor(prisma, userId),
    restriction.type,
    restriction.reason,
    restriction.expiresAt,
    restriction.lifted,
  )
  await prisma.notification.create({
    data: {
      userId,
      type: 'ACCOUNT_RESTRICTED',
      title: copy.title,
      body: copy.body,
      url: RESTRICTION_URL[restriction.type],
    },
  })
}

/** Tells an account the board changed one of its settings from Admin →
 * Users (channel kind, storage target, tier, membership), so a change it
 * didn't make isn't a mystery. */
export async function notifyUserOfBoardAccountChange(
  prisma: PrismaClient,
  userId: string,
  change: { title: string; body?: string | null; url: string },
): Promise<void> {
  const user = await prisma.user.findFirst({
    where: { id: userId, ...availableUserWhere },
    select: { id: true },
  })
  if (!user) return
  await prisma.notification.create({
    data: {
      userId: user.id,
      type: 'BOARD_ACCOUNT_CHANGE',
      title: change.title,
      body: change.body?.slice(0, 500) ?? null,
      url: change.url,
    },
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

/** Tells a channel's owner the board ended their live broadcast from Admin →
 * Streams, so a cut stream doesn't look like a crash. */
export async function notifyOwnerOfForcedOffline(
  prisma: PrismaClient,
  ownerUserId: string,
): Promise<void> {
  const copy = forcedOfflineCopy(await localeFor(prisma, ownerUserId))
  await prisma.notification.create({
    data: {
      userId: ownerUserId,
      type: 'CHANNEL_FORCED_OFFLINE',
      title: copy.title,
      body: copy.body,
      url: '/help',
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
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
          deletedAt: true,
          suspendedAt: true,
        },
      },
    },
  })

  let notified = 0
  for (const post of due) {
    // A post that comes due after its author was suspended or deleted is
    // closed without telling anyone; followers would land on a hidden page.
    if (!post.user.deletedAt && !post.user.suspendedAt) {
      await notifyFollowersOfNewPost(prisma, post.user, post)
      notified++
    }
    await prisma.artistPost.update({
      where: { id: post.id },
      data: { notifiedAt: new Date() },
    })
  }

  return { notified }
}
