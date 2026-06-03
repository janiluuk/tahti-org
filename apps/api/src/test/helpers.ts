// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import type { PrismaClient, User, Channel, MembershipStatus, ArtistTier } from '@tahti/db'
import { hashPassword } from '../lib/password.js'
import { createSession } from '../lib/session.js'
import { generateVerificationToken, verificationExpiresAt } from '../lib/token.js'

export interface TestArtistOptions {
  email: string
  username: string
  displayName?: string
  tier?: ArtistTier
  isMember?: boolean
  isBoard?: boolean
  memberNumber?: number
  membershipStatus?: MembershipStatus
  emailVerified?: boolean
  weeklyLiveSecondsUsed?: number
  weeklyLiveResetAt?: Date
}

export async function createTestArtist(prisma: PrismaClient, opts: TestArtistOptions) {
  const passwordHash = await hashPassword('testpassword')
  const liveSourcePass = `pass-${opts.username}`
  const liveSourcePassHash = await hashPassword(liveSourcePass)

  return prisma.user.create({
    data: {
      email: opts.email,
      passwordHash,
      username: opts.username,
      displayName: opts.displayName ?? opts.username,
      tier: opts.tier ?? 'FREE',
      isMember: opts.isMember ?? false,
      isBoard: opts.isBoard ?? false,
      memberNumber: opts.memberNumber,
      memberSince: opts.isMember ? new Date() : undefined,
      emailVerifiedAt: opts.emailVerified !== false ? new Date() : null,
      weeklyLiveSecondsUsed: opts.weeklyLiveSecondsUsed ?? 0,
      weeklyLiveResetAt: opts.weeklyLiveResetAt,
      membership: {
        create: {
          status: opts.membershipStatus ?? (opts.isMember ? 'ACTIVE' : 'PENDING_PAYMENT'),
          activatedAt: opts.isMember ? new Date() : undefined,
        },
      },
      channel: {
        create: {
          slug: opts.username,
          liveSourceMount: `/live/${opts.username}`,
          liveSourcePass,
          liveSourcePassHash,
          rtmpStreamKey: `${opts.username}__testkey`,
          rtmpStreamKeyHash: await hashPassword(`${opts.username}__testkey`),
        },
      },
    },
    include: { channel: true, membership: true },
  })
}

export async function sessionCookieFor(prisma: PrismaClient, userId: string): Promise<string> {
  const session = await createSession(prisma, userId)
  return `tahti_session=${session.id}`
}

export async function createEmailVerificationToken(
  prisma: PrismaClient,
  userId: string,
): Promise<string> {
  const token = generateVerificationToken()
  await prisma.emailVerification.create({
    data: { userId, token, expiresAt: verificationExpiresAt() },
  })
  return token
}

export async function createReadyArchiveItem(
  prisma: PrismaClient,
  channelId: string,
  title = 'Test track',
) {
  return prisma.archiveItem.create({
    data: {
      channelId,
      title,
      rawKey: `raw/${channelId}.wav`,
      mp3Key: `mp3/${channelId}.mp3`,
      fileSizeBytes: BigInt(5_000_000),
      status: 'READY',
    },
  })
}

export async function cleanupNewsletterForUserIds(prisma: PrismaClient, userIds: string[]) {
  if (userIds.length === 0) return
  const drafts = await prisma.newsletterDraft.findMany({
    where: { userId: { in: userIds } },
    select: { id: true },
  })
  const draftIds = drafts.map((d) => d.id)
  if (draftIds.length > 0) {
    await prisma.newsletterSend.deleteMany({ where: { draftId: { in: draftIds } } })
  }
  await prisma.newsletterDraft.deleteMany({ where: { userId: { in: userIds } } })
  await prisma.newsletterSubscriber.deleteMany({ where: { artistUserId: { in: userIds } } })
}

export async function cleanupVenuesBySlugPrefix(prisma: PrismaClient, prefix: string) {
  const venues = await prisma.venue.findMany({
    where: { slug: { startsWith: prefix } },
    select: { id: true },
  })
  const ids = venues.map((v) => v.id)
  if (ids.length === 0) return
  await prisma.venueBroadcast.deleteMany({ where: { venueId: { in: ids } } })
  await prisma.venue.deleteMany({ where: { id: { in: ids } } })
}

export async function createPublishedReleaseWithTrack(
  prisma: PrismaClient,
  userId: string,
  opts?: { smartLinkSlug?: string; streamKey?: string; flacKey?: string },
) {
  const slug = opts?.smartLinkSlug ?? `rel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  return prisma.release.create({
    data: {
      userId,
      title: 'Embed Test Release',
      type: 'SINGLE',
      releaseDate: new Date('2026-01-01'),
      smartLinkSlug: slug,
      state: 'PUBLISHED',
      publishedAt: new Date(),
      tracks: {
        create: {
          position: 1,
          title: 'Main Track',
          durationSec: 200,
          status: 'READY',
          streamKey: opts?.streamKey ?? 'streams/embed-test.opus',
          flacKey: opts?.flacKey,
        },
      },
    },
    include: { tracks: true },
  })
}

export async function cleanupUsersByEmailPrefix(prisma: PrismaClient, prefix: string) {
  const users = await prisma.user.findMany({
    where: { email: { startsWith: prefix } },
    select: { id: true, channel: { select: { id: true } } },
  })
  const ids = users.map((u) => u.id)
  if (ids.length === 0) return

  await prisma.mention.deleteMany({
    where: { OR: [{ mentionerUserId: { in: ids } }, { targetUserId: { in: ids } }] },
  })
  await prisma.mentionMute.deleteMany({
    where: { OR: [{ muterId: { in: ids } }, { targetUserId: { in: ids } }] },
  })
  await prisma.mixUpload.deleteMany({ where: { userId: { in: ids } } })
  await cleanupNewsletterForUserIds(prisma, ids)
  await prisma.fanSubPayout.deleteMany({ where: { artistUserId: { in: ids } } })
  await prisma.fanSubscription.deleteMany({
    where: { OR: [{ artistUserId: { in: ids } }, { subscriberUserId: { in: ids } }] },
  })
  await prisma.fanTier.deleteMany({ where: { artistUserId: { in: ids } } })
  await prisma.release.deleteMany({ where: { userId: { in: ids } } })
  await prisma.grantDisbursement.deleteMany({ where: { userId: { in: ids } } })
  await prisma.ledgerEntry.deleteMany({ where: { externalRef: { contains: 'fansub:' } } })
  await prisma.ledgerEntry.deleteMany({ where: { externalRef: { contains: 'membership:' } } })

  for (const u of users) {
    if (u.channel) await prisma.download.deleteMany({ where: { channelId: u.channel.id } })
  }
  await prisma.user.deleteMany({ where: { id: { in: ids } } })
}

/** Remove fixture users reserved by member number (shared test DB isolation). */
export async function cleanupUsersByMemberNumbers(prisma: PrismaClient, numbers: number[]) {
  const users = await prisma.user.findMany({
    where: { memberNumber: { in: numbers } },
    select: { id: true, channel: { select: { id: true } } },
  })
  const ids = users.map((u) => u.id)
  if (ids.length === 0) return

  await prisma.fanSubPayout.deleteMany({ where: { artistUserId: { in: ids } } })
  await prisma.fanSubscription.deleteMany({
    where: { OR: [{ artistUserId: { in: ids } }, { subscriberUserId: { in: ids } }] },
  })
  await prisma.fanTier.deleteMany({ where: { artistUserId: { in: ids } } })
  await prisma.release.deleteMany({ where: { userId: { in: ids } } })
  await prisma.grantDisbursement.deleteMany({ where: { userId: { in: ids } } })
  await prisma.vote.deleteMany({ where: { userId: { in: ids } } })
  await prisma.motion.deleteMany({ where: { proposedBy: { in: ids } } })

  for (const u of users) {
    if (u.channel) await prisma.download.deleteMany({ where: { channelId: u.channel.id } })
  }
  await prisma.user.deleteMany({ where: { id: { in: ids } } })
}

export type UserWithChannel = User & { channel: Channel | null }
