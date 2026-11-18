// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient, Prisma } from '@tahti/db'

type Db = PrismaClient | Prisma.TransactionClient

/** Every channel owner is also a ChannelModerator of their own channel so
 * they appear in the moderators list and share the same staff path as
 * delegated mods. Idempotent. */
export async function ensureChannelOwnerModerator(
  prisma: Db,
  channelId: string,
  ownerUserId: string,
): Promise<void> {
  await prisma.channelModerator.upsert({
    where: { channelId_userId: { channelId, userId: ownerUserId } },
    create: { channelId, userId: ownerUserId },
    update: {},
  })
}
