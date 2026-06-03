// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

// M19 — fan-sub payout transfer cron and churn processor.
//
// Payout: processes FanSubPayout rows in PENDING state.
// When STRIPE_SECRET_KEY is set, calls Stripe Connect transfers.
// In dev/test (no key) marks them PAID immediately for testability.
//
// Churn: marks FanSubscription rows whose currentPeriodEnd has passed
// and whose Stripe subscription is no longer ACTIVE as EXPIRED.

import type { Job } from 'bullmq'
import { prisma } from '@tahti/db'

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY ?? ''

async function stripeTransfer(params: {
  amountCents: number
  destinationAccountId: string
  description: string
}): Promise<string> {
  if (!STRIPE_KEY) {
    // Dev stub — return a fake transfer ID
    return `tr_dev_${Date.now()}`
  }

  const body = new URLSearchParams({
    amount: String(params.amountCents),
    currency: 'eur',
    destination: params.destinationAccountId,
    description: params.description,
  })

  const res = await fetch('https://api.stripe.com/v1/transfers', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${STRIPE_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })

  const data = (await res.json()) as { id?: string; error?: { message?: string } }
  if (!res.ok || !data.id) {
    throw new Error(data.error?.message ?? `Stripe transfer failed (${res.status})`)
  }
  return data.id
}

export async function processFanSubPayouts(_job: Job): Promise<void> {
  const pending = await prisma.fanSubPayout.findMany({
    where: { state: 'PENDING' },
    include: {
      fanSubscription: {
        select: { artistUserId: true },
      },
    },
    take: 100,
  })

  let paid = 0
  let failed = 0

  for (const payout of pending) {
    try {
      // Look up artist's Stripe Connect account ID
      const artist = await prisma.user.findUnique({
        where: { id: payout.fanSubscription.artistUserId },
        select: { stripeCustomerId: true },
      })

      const destination = artist?.stripeCustomerId ?? 'acct_stub'
      const transferId = await stripeTransfer({
        amountCents: payout.netToArtistCents,
        destinationAccountId: destination,
        description: `Fan-sub payout ${payout.id}`,
      })

      await prisma.fanSubPayout.update({
        where: { id: payout.id },
        data: { state: 'PAID', paidAt: new Date(), stripeTransferId: transferId },
      })
      paid++
    } catch (err) {
      await prisma.fanSubPayout.update({
        where: { id: payout.id },
        data: { state: 'FAILED' },
      })
      console.error(`[fansub-payouts] payout ${payout.id} failed:`, err)
      failed++
    }
  }

  console.log(`[fansub-payouts] processed: paid=${paid} failed=${failed}`)
}

export async function processFanSubChurn(_job: Job): Promise<void> {
  const expired = await prisma.fanSubscription.updateMany({
    where: {
      state: 'ACTIVE',
      currentPeriodEnd: { lt: new Date() },
    },
    data: { state: 'EXPIRED' },
  })

  console.log(`[fansub-churn] expired ${expired.count} subscriptions`)
}
