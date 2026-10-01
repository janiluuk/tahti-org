// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'
import { processFanSubPayouts } from '@tahti/ledger'
import { createConnectTransfer } from '../lib/stripe-transfer.js'
import { announcePayoutsSince } from '../lib/payout-notice.js'

export async function processFanSubPayoutsJob(prisma: PrismaClient) {
  const transfer =
    process.env.STRIPE_SECRET_KEY != null && process.env.STRIPE_SECRET_KEY !== ''
      ? createConnectTransfer
      : undefined

  const startedAt = new Date()
  const result = await processFanSubPayouts(prisma, { transfer })
  const notices = await announcePayoutsSince(prisma, startedAt)
  return { ...result, ...notices }
}
