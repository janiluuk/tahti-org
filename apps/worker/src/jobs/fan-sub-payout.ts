// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'

const RETRY_AFTER_MS = 24 * 60 * 60 * 1000

/**
 * Marks fan-sub payouts settled. With subscription destination charges, Stripe
 * routes net funds to the artist Connect account on payment; this job records
 * that settlement in our ledger and retries FAILED rows once per day.
 */
export async function processFanSubPayouts(prisma: PrismaClient) {
  const pending = await prisma.fanSubPayout.findMany({
    where: { state: 'PENDING' },
    take: 100,
    orderBy: { createdAt: 'asc' },
  })

  let completed = 0
  let skipped = 0
  let failed = 0

  for (const payout of pending) {
    const artist = await prisma.user.findUnique({
      where: { id: payout.artistUserId },
      select: { stripeConnectAccountId: true, stripeConnectChargesEnabled: true },
    })

    if (!artist?.stripeConnectAccountId || !artist.stripeConnectChargesEnabled) {
      skipped++
      continue
    }

    try {
      await prisma.fanSubPayout.update({
        where: { id: payout.id },
        data: {
          state: 'PAID',
          paidAt: new Date(),
          stripeTransferId: 'connect_destination',
        },
      })
      completed++
    } catch {
      await prisma.fanSubPayout.update({
        where: { id: payout.id },
        data: { state: 'FAILED' },
      })
      failed++
    }
  }

  const staleFailed = await prisma.fanSubPayout.findMany({
    where: {
      state: 'FAILED',
      createdAt: { lt: new Date(Date.now() - RETRY_AFTER_MS) },
    },
    take: 50,
  })

  let retried = 0
  for (const payout of staleFailed) {
    await prisma.fanSubPayout.update({
      where: { id: payout.id },
      data: { state: 'PENDING' },
    })
    retried++
  }

  return { completed, skipped, failed, retried }
}
