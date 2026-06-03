// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'
import { processFanSubPayouts } from '@tahti/ledger'
import { createConnectTransfer } from '../lib/stripe-transfer.js'

export async function processFanSubPayoutsJob(prisma: PrismaClient) {
  const transfer =
    process.env.STRIPE_SECRET_KEY != null && process.env.STRIPE_SECRET_KEY !== ''
      ? createConnectTransfer
      : undefined

  return processFanSubPayouts(prisma, { transfer })
}
