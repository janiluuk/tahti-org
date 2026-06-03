// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'

const RETRY_AFTER_MS = 24 * 60 * 60 * 1000

export type FanSubTransferFn = (params: {
  amountCents: number
  destinationAccountId: string
  idempotencyKey: string
  description: string
}) => Promise<string>

export interface ProcessFanSubPayoutsOptions {
  /** When set, retry FAILED payouts with an explicit Connect transfer. */
  transfer?: FanSubTransferFn
}

/**
 * Settles fan-sub payout rows. With Connect destination charges, net funds usually
 * route on payment; this job marks bookkeeping PAID and retries FAILED transfers.
 */
export async function processFanSubPayouts(
  prisma: PrismaClient,
  options: ProcessFanSubPayoutsOptions = {},
) {
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
          stripeTransferId: payout.stripeTransferId ?? 'connect_destination',
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
    orderBy: { createdAt: 'asc' },
  })

  let transferRetried = 0
  let requeued = 0

  for (const payout of staleFailed) {
    if (options.transfer) {
      const artist = await prisma.user.findUnique({
        where: { id: payout.artistUserId },
        select: { stripeConnectAccountId: true, stripeConnectChargesEnabled: true },
      })
      if (artist?.stripeConnectAccountId && artist.stripeConnectChargesEnabled) {
        try {
          const transferId = await options.transfer({
            amountCents: payout.netToArtistCents,
            destinationAccountId: artist.stripeConnectAccountId,
            idempotencyKey: `fansub-payout-${payout.id}`,
            description: `Tahti fan-sub payout ${payout.id}`,
          })
          await prisma.fanSubPayout.update({
            where: { id: payout.id },
            data: {
              state: 'PAID',
              paidAt: new Date(),
              stripeTransferId: transferId,
            },
          })
          transferRetried++
          continue
        } catch {
          // fall through to requeue for destination-charge bookkeeping path
        }
      }
    }

    await prisma.fanSubPayout.update({
      where: { id: payout.id },
      data: { state: 'PENDING' },
    })
    requeued++
  }

  return { completed, skipped, failed, transferRetried, requeued }
}
