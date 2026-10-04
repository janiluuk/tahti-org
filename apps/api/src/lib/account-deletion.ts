// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { Prisma, type PrismaClient } from '@tahti/db'
import type { FastifyBaseLogger } from 'fastify'
import { hashPassword } from './password.js'
import { auditLog } from './audit.js'
import { forceChannelOffline } from './force-channel-offline.js'
import { cancelStripeSubscription, stripeEnabled } from './stripe.js'

export interface AccountDeletionResult {
  userId: string
  fanSubscriptionsCanceled: number
  newsletterSubscribersRemoved: number
}

/** M19: anonymize user PII, cancel billing, purge newsletter/fan-sub ties. */
export async function executeAccountDeletion(
  prisma: PrismaClient,
  log: FastifyBaseLogger,
  params: { userId: string; actorId: string },
): Promise<AccountDeletionResult> {
  const { userId, actorId } = params

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      deletedAt: true,
      isBoard: true,
      stripeMembershipSubscriptionId: true,
      channel: { select: { id: true, slug: true, state: true } },
    },
  })

  if (!user) throw new Error('User not found')
  if (user.deletedAt) throw new Error('Account already deleted')
  if (user.isBoard) throw new Error('Remove board role before deleting a board member')
  if (userId === actorId) throw new Error('Cannot delete your own account via admin')

  if (user.channel && user.channel.state !== 'OFFLINE') {
    await forceChannelOffline(prisma, log, {
      channelId: user.channel.id,
      slug: user.channel.slug,
    })
  }

  let fanSubscriptionsCanceled = 0

  if (stripeEnabled && user.stripeMembershipSubscriptionId) {
    try {
      await cancelStripeSubscription(user.stripeMembershipSubscriptionId)
    } catch (err) {
      log.warn({ err, userId }, 'membership subscription cancel failed')
    }
  }

  const fanSubs = await prisma.fanSubscription.findMany({
    where: {
      OR: [{ artistUserId: userId }, { subscriberUserId: userId }],
      state: { in: ['ACTIVE', 'PAST_DUE'] },
    },
    select: { id: true, stripeSubscriptionId: true },
  })

  for (const sub of fanSubs) {
    if (stripeEnabled) {
      try {
        await cancelStripeSubscription(sub.stripeSubscriptionId)
      } catch (err) {
        log.warn({ err, subscriptionId: sub.stripeSubscriptionId }, 'fan-sub cancel failed')
      }
    }
    await prisma.fanSubscription.update({
      where: { id: sub.id },
      data: { state: 'CANCELED', canceledAt: new Date() },
    })
    fanSubscriptionsCanceled++
  }

  const newsletterSubscribersRemoved = (
    await prisma.newsletterSubscriber.deleteMany({ where: { artistUserId: userId } })
  ).count

  await prisma.newsletterSubscriber.deleteMany({ where: { email: user.email } })
  await prisma.socialConnection.deleteMany({ where: { userId } })
  await prisma.socialPost.deleteMany({ where: { userId } })

  await prisma.session.deleteMany({ where: { userId } })
  await prisma.emailVerification.deleteMany({ where: { userId } })

  // Nothing that can act for the account, or reach a third party in its name,
  // outlives it: API tokens, 2FA material, integration secrets, stream keys
  // for mirrored broadcasts and moderator rights on other channels.
  await prisma.apiToken.deleteMany({ where: { userId } })
  await prisma.totpBackupCode.deleteMany({ where: { userId } })
  await prisma.totpChallenge.deleteMany({ where: { userId } })
  await prisma.integrationCredential.deleteMany({ where: { userId } })
  await prisma.channelModerator.deleteMany({ where: { userId } })
  if (user.channel) {
    await prisma.rtmpTarget.deleteMany({ where: { channelId: user.channel.id } })
    await prisma.channelModerator.deleteMany({ where: { channelId: user.channel.id } })
  }

  await prisma.release.updateMany({
    where: { userId, state: { not: 'ARCHIVED' } },
    data: { state: 'ARCHIVED' },
  })

  if (user.channel) {
    await prisma.sound.updateMany({
      where: { channelId: user.channel.id, isPublic: true },
      data: { isPublic: false },
    })
  }
  await prisma.collection.updateMany({
    where: { userId },
    data: { isPublic: false, visibility: 'DRAFT' },
  })

  // Past bookings and events stay as history; future ones would otherwise keep
  // listing "Deleted user" and keep the radio slot blocked for other artists.
  const now = new Date()
  if (user.channel) {
    await prisma.radioSlotBooking.deleteMany({
      where: { channelId: user.channel.id, startAt: { gt: now } },
    })
  }
  await prisma.artistEvent.deleteMany({ where: { userId, startAt: { gt: now } } })

  await prisma.supportTicket.updateMany({
    where: { artistId: userId, status: { in: ['OPEN', 'IN_PROGRESS'] } },
    data: { status: 'RESOLVED' },
  })

  const tombstoneEmail = `deleted+${userId}@deleted.tahti.live`
  const tombstoneUsername = `deleted-${userId.slice(0, 12)}`
  const invalidPassword = await hashPassword(`deleted-${userId}-${Date.now()}`)

  await prisma.user.update({
    where: { id: userId },
    data: {
      email: tombstoneEmail,
      username: tombstoneUsername,
      displayName: 'Deleted user',
      bio: null,
      avatarUrl: null,
      socialLinks: Prisma.DbNull,
      tipJarUrl: null,
      passwordHash: invalidPassword,
      isMember: false,
      isBoard: false,
      memberNumber: null,
      memberSince: null,
      stripeCustomerId: null,
      stripeMembershipSubscriptionId: null,
      stripeConnectAccountId: null,
      stripeConnectChargesEnabled: false,
      mixcloudAccessTokenEnc: null,
      bandcampAccessTokenEnc: null,
      soundcloudAccessTokenEnc: null,
      googleDriveAccessTokenEnc: null,
      googleDriveRefreshTokenEnc: null,
      musicbrainzAccessTokenEnc: null,
      musicbrainzRefreshTokenEnc: null,
      totpSecretEnc: null,
      totpEnabledAt: null,
      suspendedAt: null,
      suspendReason: null,
      deletedAt: new Date(),
      membership: {
        update: { status: 'RESIGNED' },
      },
    },
  })

  await auditLog(prisma, {
    action: 'ACCOUNT_DELETE',
    actorId,
    targetId: userId,
    meta: { fanSubscriptionsCanceled, newsletterSubscribersRemoved },
  })

  return { userId, fanSubscriptionsCanceled, newsletterSubscribersRemoved }
}
