// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'
import { computeFanSubSplit } from '@tahti/ledger'
import { stripeEnabled } from './stripe.js'

// Shared fan-subscription lifecycle used by both the dev/test direct-activation
// path and the production Stripe webhook handler, so the two never diverge.

export interface ActivateInput {
  artistUserId: string
  subscriberUserId: string
  tierName: string
  amountCents: number
  stripeSubscriptionId: string
  currentPeriodEnd: Date
}

// Upserts an ACTIVE subscription (idempotent on the artist/subscriber pair).
export async function activateSubscription(prisma: PrismaClient, input: ActivateInput) {
  return prisma.fanSubscription.upsert({
    where: {
      artistUserId_subscriberUserId: {
        artistUserId: input.artistUserId,
        subscriberUserId: input.subscriberUserId,
      },
    },
    update: {
      tierName: input.tierName,
      amountCents: input.amountCents,
      stripeSubscriptionId: input.stripeSubscriptionId,
      state: 'ACTIVE',
      currentPeriodEnd: input.currentPeriodEnd,
      canceledAt: null,
    },
    create: {
      artistUserId: input.artistUserId,
      subscriberUserId: input.subscriberUserId,
      tierName: input.tierName,
      amountCents: input.amountCents,
      stripeSubscriptionId: input.stripeSubscriptionId,
      state: 'ACTIVE',
      currentPeriodEnd: input.currentPeriodEnd,
    },
  })
}

// Records a single billing-period payment: a PAID payout row (with the fee
// split) plus the three transparency ledger entries (gross in, net to artist,
// 2% operational fee). Passthrough — fan-sub money is not org revenue.
export async function recordFanSubPayment(
  prisma: PrismaClient,
  args: {
    subscriptionId: string
    artistUserId: string
    grossCents: number
    periodStart: Date
    periodEnd: Date
  },
) {
  const split = computeFanSubSplit(args.grossCents)
  // With Connect destination charges, net funds route on payment; cron marks PAID.
  const settleNow = !stripeEnabled

  return prisma.$transaction(async (tx) => {
    const payout = await tx.fanSubPayout.create({
      data: {
        fanSubscriptionId: args.subscriptionId,
        artistUserId: args.artistUserId,
        forPeriodStart: args.periodStart,
        forPeriodEnd: args.periodEnd,
        grossCents: split.grossCents,
        stripeFeeCents: split.stripeFeeCents,
        orgFeeCents: split.orgFeeCents,
        netToArtistCents: split.netToArtistCents,
        state: settleNow ? 'PAID' : 'PENDING',
        paidAt: settleNow ? new Date() : null,
        stripeTransferId: settleNow ? 'dev_settled' : null,
      },
    })

    const ref = `fansub:${args.subscriptionId}:${args.periodStart.toISOString()}`
    await tx.ledgerEntry.createMany({
      data: [
        {
          category: 'FAN_SUB_GROSS_RECEIVED',
          amountCents: BigInt(split.grossCents),
          description: `Fan-sub gross received (artist ${args.artistUserId})`,
          externalRef: `${ref}:gross`,
          periodStart: args.periodStart,
          periodEnd: args.periodEnd,
          createdBy: 'system',
        },
        {
          category: 'FAN_SUB_NET_TO_ARTIST',
          amountCents: BigInt(split.netToArtistCents),
          description: `Fan-sub net paid to artist (artist ${args.artistUserId})`,
          externalRef: `${ref}:net`,
          periodStart: args.periodStart,
          periodEnd: args.periodEnd,
          createdBy: 'system',
        },
        {
          category: 'FAN_SUB_OPERATIONAL_FEE',
          amountCents: BigInt(split.orgFeeCents),
          description: `Fan-sub 2% operational fee (artist ${args.artistUserId})`,
          externalRef: `${ref}:fee`,
          periodStart: args.periodStart,
          periodEnd: args.periodEnd,
          createdBy: 'system',
        },
      ],
    })

    return payout
  })
}

// True if the subscriber has an ACTIVE subscription to the artist that hasn't
// lapsed. Used for the 5× paid-download weight (M18) and access gating.
export async function isActiveFanSubscriber(
  prisma: PrismaClient,
  artistUserId: string,
  subscriberUserId: string,
): Promise<boolean> {
  const sub = await prisma.fanSubscription.findUnique({
    where: { artistUserId_subscriberUserId: { artistUserId, subscriberUserId } },
    select: { state: true, currentPeriodEnd: true },
  })
  if (!sub) return false
  const now = new Date()
  if (sub.state === 'EXPIRED' || sub.state === 'PAST_DUE') return false
  if (sub.state === 'ACTIVE') return sub.currentPeriodEnd > now
  if (sub.state === 'CANCELED') {
    const graceEnd = new Date(sub.currentPeriodEnd.getTime() + 7 * 24 * 60 * 60 * 1000)
    return now < graceEnd
  }
  return false
}

/** User or Stripe canceled — perks continue until currentPeriodEnd. */
export async function markFanSubCanceledAtPeriodEnd(
  prisma: PrismaClient,
  opts: { subscriptionId?: string; stripeSubscriptionId?: string },
) {
  const where = opts.subscriptionId
    ? { id: opts.subscriptionId }
    : { stripeSubscriptionId: opts.stripeSubscriptionId! }

  return prisma.fanSubscription.updateMany({
    where,
    data: { state: 'CANCELED', canceledAt: new Date() },
  })
}

const GRACE_MS = 7 * 24 * 60 * 60 * 1000

/** Close subscriptions past access window (period end, or period end + 7d if canceled). */
export async function expireLapsedFanSubscriptions(prisma: PrismaClient) {
  const now = new Date()
  const graceCutoff = new Date(now.getTime() - GRACE_MS)
  const active = await prisma.fanSubscription.updateMany({
    where: { state: 'ACTIVE', currentPeriodEnd: { lt: now } },
    data: { state: 'EXPIRED' },
  })
  const canceled = await prisma.fanSubscription.updateMany({
    where: { state: 'CANCELED', currentPeriodEnd: { lt: graceCutoff } },
    data: { state: 'EXPIRED' },
  })
  return active.count + canceled.count
}
