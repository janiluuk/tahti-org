// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'
import { config } from '../config.js'

const MEMBERSHIP_TERM_MS = 365 * 24 * 60 * 60 * 1000

export function membershipRenewalDueAt(memberSince: Date | null | undefined): Date | null {
  if (!memberSince) return null
  return new Date(memberSince.getTime() + MEMBERSHIP_TERM_MS)
}

// Tahti ry annual membership (€40/year). Activated after Stripe Checkout or the
// dev/test direct path when Stripe is not configured.

export async function activateMembership(
  prisma: PrismaClient,
  userId: string,
  opts: {
    stripeSessionId: string
    amountCents?: number
    stripeCustomerId?: string
    stripeSubscriptionId?: string
    /** When true (default), write REVENUE_SUBSCRIPTION for one-time checkout. Subscription mode defers to invoice.paid. */
    recordLedger?: boolean
  },
) {
  const amountCents = opts.amountCents ?? config.membership.priceCents
  const now = new Date()
  const periodEnd = new Date(now)
  periodEnd.setUTCFullYear(periodEnd.getUTCFullYear() + 1)
  const recordLedger = opts.recordLedger !== false

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        isMember: true,
        memberNumber: true,
        stripeMembershipSubscriptionId: true,
      },
    })
    if (!user) throw new Error('User not found')

    // Idempotent: already active (one-time or same Stripe subscription).
    if (user.isMember) {
      if (
        !opts.stripeSubscriptionId ||
        user.stripeMembershipSubscriptionId === opts.stripeSubscriptionId
      ) {
        const membership = await tx.membership.findUnique({ where: { userId } })
        return { alreadyActive: true as const, membership }
      }
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
        ...(opts.stripeSubscriptionId
          ? { stripeMembershipSubscriptionId: opts.stripeSubscriptionId }
          : {}),
      },
    })

    const membership = await tx.membership.update({
      where: { userId },
      data: { status: 'ACTIVE', activatedAt: now },
    })

    if (recordLedger) {
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
    }

    return { alreadyActive: false as const, membership, memberNumber: memberNumber! }
  })
}

/** Stripe subscription renewal — invoice.paid for tahtiMembershipSubscriptionId. */
export async function recordMembershipRenewal(
  prisma: PrismaClient,
  userId: string,
  opts: {
    stripeInvoiceId: string
    amountCents: number
    stripeCustomerId?: string
    stripeSubscriptionId?: string
    periodStart?: Date
    periodEnd?: Date
  },
) {
  const periodStart = opts.periodStart ?? new Date()
  const periodEnd = opts.periodEnd ?? new Date(periodStart.getTime() + MEMBERSHIP_TERM_MS)

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true, memberNumber: true },
    })
    if (!user) throw new Error('User not found')

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
        memberSince: periodStart,
        tier: 'ARTIST',
        ...(opts.stripeCustomerId ? { stripeCustomerId: opts.stripeCustomerId } : {}),
        ...(opts.stripeSubscriptionId
          ? { stripeMembershipSubscriptionId: opts.stripeSubscriptionId }
          : {}),
      },
    })

    const membership = await tx.membership.update({
      where: { userId },
      data: { status: 'ACTIVE', activatedAt: periodStart },
    })

    const ref = `membership-invoice:${opts.stripeInvoiceId}`
    const existing = await tx.ledgerEntry.findFirst({ where: { externalRef: ref } })
    if (!existing) {
      await tx.ledgerEntry.create({
        data: {
          category: 'REVENUE_SUBSCRIPTION',
          amountCents: BigInt(opts.amountCents),
          description: `Annual membership renewal (user ${userId})`,
          externalRef: ref,
          periodStart,
          periodEnd,
          createdBy: 'system',
        },
      })
    }

    return { membership, memberNumber: memberNumber! }
  })
}
