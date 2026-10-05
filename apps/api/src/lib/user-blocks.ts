// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'

/** True when either account has blocked the other. A block cuts contact in
 * both directions, and neither side is told which of them set it. */
export async function isBlockedEitherWay(
  prisma: PrismaClient,
  userId: string,
  otherUserId: string,
): Promise<boolean> {
  const block = await prisma.userBlock.findFirst({
    where: {
      OR: [
        { blockerUserId: userId, blockedUserId: otherUserId },
        { blockerUserId: otherUserId, blockedUserId: userId },
      ],
    },
    select: { blockerUserId: true },
  })
  return block !== null
}
