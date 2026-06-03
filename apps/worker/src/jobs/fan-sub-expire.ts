// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'

const GRACE_MS = 7 * 24 * 60 * 60 * 1000

export async function processFanSubExpire(prisma: PrismaClient) {
  const now = new Date()
  const graceCutoff = new Date(now.getTime() - GRACE_MS)
  const active = await prisma.fanSubscription.updateMany({
    where: { state: 'ACTIVE', currentPeriodEnd: { lt: now } },
    data: { state: 'EXPIRED' },
  })
  const canceled = await prisma.fanSubscription.updateMany({
    where: { state: 'CANCELED', currentPeriodEnd: { lt: graceCutoff } },
    data: { state: 'EXPIRED' },
  })
  return { expired: active.count + canceled.count }
}
