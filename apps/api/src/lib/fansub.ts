// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'
import { computeFanSubSplit } from '@tahti/ledger'

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
        state: 'PAID',
        paidAt: new Date(),
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
  return !!sub && sub.state === 'ACTIVE' && sub.currentPeriodEnd > new Date()
}
