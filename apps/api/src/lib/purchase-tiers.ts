// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'
import { computeFanSubSplit } from '@tahti/ledger'
import { isActiveFanSubscriber } from './fansub.js'

// One-time-purchase tiers (per-track paywall) — distinct from the recurring
// FanTier/FanSubscription system. An active fan-subscriber always bypasses
// this gate; buying one tier never unlocks another tier's tracks.

export type PlaybackGateStatus =
  { allowed: true } | { allowed: false; reason: 'SUBSCRIBERS_ONLY' | 'PURCHASE'; tierId?: string }

export async function hasPurchasedTier(
  prisma: PrismaClient,
  buyerUserId: string,
  tierId: string,
): Promise<boolean> {
  const purchase = await prisma.purchase.findFirst({
    where: { buyerUserId, tierId, state: 'PAID' },
    select: { id: true },
  })
  return !!purchase
}

export async function resolvePlaybackGateStatus(
  prisma: PrismaClient,
  item: {
    artistUserId: string
    accessMode: 'FREE' | 'SUBSCRIBERS_ONLY' | 'PURCHASE'
    purchaseTierId: string | null
  },
  viewerUserId: string | null,
): Promise<PlaybackGateStatus> {
  if (item.accessMode === 'FREE') return { allowed: true }
  // The artist can always play their own gated tracks.
  if (viewerUserId && viewerUserId === item.artistUserId) return { allowed: true }
  if (!viewerUserId) {
    return item.accessMode === 'PURCHASE'
      ? { allowed: false, reason: 'PURCHASE', tierId: item.purchaseTierId ?? undefined }
      : { allowed: false, reason: 'SUBSCRIBERS_ONLY' }
  }

  const subscribed = await isActiveFanSubscriber(prisma, item.artistUserId, viewerUserId)
  if (subscribed) return { allowed: true }

  if (item.accessMode === 'SUBSCRIBERS_ONLY') {
    return { allowed: false, reason: 'SUBSCRIBERS_ONLY' }
  }

  // PURCHASE
  if (item.purchaseTierId && (await hasPurchasedTier(prisma, viewerUserId, item.purchaseTierId))) {
    return { allowed: true }
  }
  return { allowed: false, reason: 'PURCHASE', tierId: item.purchaseTierId ?? undefined }
}

// Records a completed (or free-claimed) one-time purchase: a PAID Purchase row
// plus the three transparency ledger entries (gross in, net to artist, 2%
// operational fee) — same split math and passthrough accounting as fan-subs.
// Idempotent on `purchaseId` so a retried webhook never double-records.
export async function recordPurchasePayment(
  prisma: PrismaClient,
  args: {
    purchaseId: string
    amountCents: number
    stripeCheckoutSessionId: string | null
  },
) {
  return prisma.$transaction(async (tx) => {
    const purchase = await tx.purchase.findUnique({
      where: { id: args.purchaseId },
      select: { id: true, state: true, artistUserId: true, tier: { select: { name: true } } },
    })
    if (!purchase) throw new Error('Purchase not found')
    if (purchase.state === 'PAID') {
      return { alreadyPaid: true as const, purchaseId: purchase.id }
    }

    await tx.purchase.update({
      where: { id: purchase.id },
      data: {
        state: 'PAID',
        amountCents: args.amountCents,
        stripeCheckoutSessionId: args.stripeCheckoutSessionId,
      },
    })

    if (args.amountCents > 0) {
      const split = computeFanSubSplit(args.amountCents)
      const ref = `purchase:${purchase.id}`
      const now = new Date()
      await tx.ledgerEntry.createMany({
        data: [
          {
            category: 'PURCHASE_TIER_GROSS_RECEIVED',
            amountCents: BigInt(split.grossCents),
            description: `Purchase-tier gross received (${purchase.tier.name}, artist ${purchase.artistUserId})`,
            externalRef: `${ref}:gross`,
            periodStart: now,
            periodEnd: now,
            createdBy: 'system',
          },
          {
            category: 'PURCHASE_TIER_NET_TO_ARTIST',
            amountCents: BigInt(split.netToArtistCents),
            description: `Purchase-tier net paid to artist (${purchase.tier.name}, artist ${purchase.artistUserId})`,
            externalRef: `${ref}:net`,
            periodStart: now,
            periodEnd: now,
            createdBy: 'system',
          },
          {
            category: 'PURCHASE_TIER_OPERATIONAL_FEE',
            amountCents: BigInt(split.orgFeeCents),
            description: `Purchase-tier 2% operational fee (${purchase.tier.name}, artist ${purchase.artistUserId})`,
            externalRef: `${ref}:fee`,
            periodStart: now,
            periodEnd: now,
            createdBy: 'system',
          },
        ],
      })
    }

    return { alreadyPaid: false as const, purchaseId: purchase.id }
  })
}
