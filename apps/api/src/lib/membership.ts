// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'
import { config } from '../config.js'

// Tahti ry annual membership (€40/year). Activated after Stripe Checkout or the
// dev/test direct path when Stripe is not configured.

export async function activateMembership(
  prisma: PrismaClient,
  userId: string,
  opts: { stripeSessionId: string; amountCents?: number; stripeCustomerId?: string },
) {
  const amountCents = opts.amountCents ?? config.membership.priceCents
  const now = new Date()
  const periodEnd = new Date(now)
  periodEnd.setUTCFullYear(periodEnd.getUTCFullYear() + 1)

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true, isMember: true, memberNumber: true },
    })
    if (!user) throw new Error('User not found')

    // Idempotent: already a paying member.
    if (user.isMember) {
      const membership = await tx.membership.findUnique({ where: { userId } })
      return { alreadyActive: true as const, membership }
    }

    let memberNumber = user.memberNumber
    if (memberNumber == null) {
      const max = await tx.user.aggregate({ _max: { memberNumber: true } })
      memberNumber = (max._max.memberNumber ?? 0) + 1
    }

    await tx.user.update({
      where: { id: userId },
      data: {
        isMember: true,
        memberNumber,
        memberSince: now,
        tier: 'ARTIST',
        ...(opts.stripeCustomerId ? { stripeCustomerId: opts.stripeCustomerId } : {}),
      },
    })

    const membership = await tx.membership.update({
      where: { userId },
      data: { status: 'ACTIVE', activatedAt: now },
    })

    const ref = `membership:${opts.stripeSessionId}`
    const existing = await tx.ledgerEntry.findFirst({ where: { externalRef: ref } })
    if (!existing) {
      await tx.ledgerEntry.create({
        data: {
          category: 'REVENUE_SUBSCRIPTION',
          amountCents: BigInt(amountCents),
          description: `Annual membership (user ${userId})`,
          externalRef: ref,
          periodStart: now,
          periodEnd,
          createdBy: 'system',
        },
      })
    }

    return { alreadyActive: false as const, membership, memberNumber: memberNumber! }
  })
}
