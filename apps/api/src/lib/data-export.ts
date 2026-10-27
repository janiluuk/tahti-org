// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'

/** What the account itself made or did, beyond the profile and billing rows
 * the export always had: uploads, collections, posts, events, comments,
 * likes, reposts, follows, messages it sent, purchases, newsletter
 * subscriptions, the accounts it blocked, its listening sessions, the chat
 * messages it posted while signed in, its track reactions, and its feature
 * requests, motion comments, seconds and votes (the member already sees their
 * own choice on each motion) and correction requests. Other
 * people appear by username only. */
export async function buildActivityExport(
  prisma: PrismaClient,
  user: { id: string; email: string },
) {
  const [
    sounds,
    collections,
    posts,
    events,
    comments,
    likes,
    reposts,
    following,
    collectionSubscriptions,
    messagesSent,
    purchases,
    newsletterSubscriptions,
    supportRequests,
    blockedAccounts,
    listening,
    chatMessages,
    trackReactions,
    featureRequests,
    featureRequestComments,
    featureRequestVotes,
    motionComments,
    motionSeconds,
    motionVotes,
    correctionRequests,
  ] = await Promise.all([
    prisma.sound.findMany({
      where: { channel: { userId: user.id } },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        title: true,
        description: true,
        contentType: true,
        isPublic: true,
        status: true,
        createdAt: true,
      },
    }),
    prisma.collection.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
      select: { slug: true, name: true, visibility: true, createdAt: true },
    }),
    prisma.artistPost.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
      select: { title: true, body: true, linkUrl: true, publishAt: true, createdAt: true },
    }),
    prisma.artistEvent.findMany({
      where: { userId: user.id },
      orderBy: { startAt: 'asc' },
      select: { title: true, description: true, place: true, location: true, startAt: true },
    }),
    prisma.comment.findMany({
      where: { authorId: user.id },
      orderBy: { createdAt: 'asc' },
      select: {
        body: true,
        createdAt: true,
        sound: { select: { id: true, title: true } },
        channel: { select: { slug: true } },
      },
    }),
    prisma.soundLike.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true, sound: { select: { id: true, title: true } } },
    }),
    prisma.soundRepost.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true, sound: { select: { id: true, title: true } } },
    }),
    prisma.artistFollow.findMany({
      where: { followerUserId: user.id },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true, artist: { select: { username: true } } },
    }),
    prisma.collectionSubscription.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true, collection: { select: { slug: true, name: true } } },
    }),
    prisma.message.findMany({
      where: { senderId: user.id },
      orderBy: { createdAt: 'asc' },
      select: { body: true, createdAt: true, conversationId: true },
    }),
    prisma.purchase.findMany({
      where: { buyerUserId: user.id },
      orderBy: { createdAt: 'asc' },
      select: {
        amountCents: true,
        state: true,
        createdAt: true,
        tier: { select: { name: true } },
      },
    }),
    prisma.newsletterSubscriber.findMany({
      where: { email: user.email },
      select: {
        confirmedAt: true,
        unsubscribedAt: true,
        artist: { select: { username: true } },
      },
    }),
    prisma.supportTicket.findMany({
      where: { artistId: user.id },
      orderBy: { createdAt: 'asc' },
      select: { subject: true, message: true, category: true, status: true, createdAt: true },
    }),
    prisma.userBlock.findMany({
      where: { blockerUserId: user.id },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true, blocked: { select: { username: true } } },
    }),
    prisma.listenSession.findMany({
      where: { byUserId: user.id },
      orderBy: { startedAt: 'asc' },
      select: {
        channelId: true,
        soundId: true,
        source: true,
        startedAt: true,
        lastSeenAt: true,
        endedAt: true,
        countryCode: true,
        city: true,
        uaBrowser: true,
        uaOs: true,
        uaDeviceType: true,
        uaDeviceVendor: true,
        referrerHost: true,
        maxPositionSec: true,
        durationSec: true,
      },
    }),
    prisma.chatMessage.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
      select: {
        text: true,
        handle: true,
        fanOnly: true,
        createdAt: true,
        removedAt: true,
        channel: { select: { slug: true } },
      },
    }),
    prisma.trackReaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
      select: {
        type: true,
        positionSec: true,
        createdAt: true,
        sound: { select: { id: true, title: true } },
      },
    }),
    prisma.featureRequest.findMany({
      where: { proposedById: user.id },
      orderBy: { createdAt: 'asc' },
      select: { title: true, description: true, status: true, createdAt: true },
    }),
    prisma.featureRequestComment.findMany({
      where: { authorId: user.id },
      orderBy: { createdAt: 'asc' },
      select: { body: true, createdAt: true, featureRequest: { select: { title: true } } },
    }),
    prisma.featureRequestVote.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true, featureRequest: { select: { title: true } } },
    }),
    prisma.motionComment.findMany({
      where: { authorId: user.id },
      orderBy: { createdAt: 'asc' },
      select: {
        body: true,
        createdAt: true,
        removedAt: true,
        motion: { select: { id: true, title: true } },
      },
    }),
    prisma.motionSecond.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true, motion: { select: { id: true, title: true } } },
    }),
    prisma.vote.findMany({
      where: { userId: user.id },
      orderBy: { castAt: 'asc' },
      select: { choice: true, castAt: true, motion: { select: { id: true, title: true } } },
    }),
    prisma.governanceCorrectionRequest.findMany({
      where: { requesterId: user.id },
      orderBy: { createdAt: 'asc' },
      select: {
        subject: true,
        details: true,
        recordKind: true,
        state: true,
        resolutionNote: true,
        resolvedAt: true,
        createdAt: true,
      },
    }),
  ])

  return {
    sounds,
    collections,
    posts,
    events,
    comments,
    likes,
    reposts,
    following,
    collectionSubscriptions,
    messagesSent,
    purchases,
    newsletterSubscriptions,
    supportRequests,
    blockedAccounts,
    listening,
    chatMessages,
    trackReactions,
    featureRequests,
    featureRequestComments,
    featureRequestVotes,
    motionComments,
    motionSeconds,
    motionVotes,
    correctionRequests,
  }
}
