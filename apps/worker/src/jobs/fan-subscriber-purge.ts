// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'
import { cancelStripeSubscription } from '../lib/stripe-transfer.js'

/** M19: retry Stripe cancel for fan-subs tied to deleted accounts. */
export async function processFanSubscriberPurgeJob(prisma: PrismaClient) {
  const deletedUsers = await prisma.user.findMany({
    where: { deletedAt: { not: null } },
    select: { id: true },
  })
  if (deletedUsers.length === 0) return { canceled: 0, retried: 0 }

  const ids = deletedUsers.map((u) => u.id)
  const stale = await prisma.fanSubscription.findMany({
    where: {
      OR: [{ artistUserId: { in: ids } }, { subscriberUserId: { in: ids } }],
      state: { in: ['ACTIVE', 'PAST_DUE'] },
    },
    select: { id: true, stripeSubscriptionId: true },
  })

  let canceled = 0
  let retried = 0
  const stripeEnabled =
    process.env.STRIPE_SECRET_KEY != null && process.env.STRIPE_SECRET_KEY !== ''
  for (const sub of stale) {
    if (stripeEnabled) {
      try {
        await cancelStripeSubscription(sub.stripeSubscriptionId)
        retried++
      } catch {
        // subscription may already be gone
      }
    }
    await prisma.fanSubscription.update({
      where: { id: sub.id },
      data: { state: 'CANCELED', canceledAt: new Date() },
    })
    canceled++
  }

  return { canceled, retried }
}
