// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'

/** The account's standing in a channel's chat: its owner, one of its
 * moderators, or nobody in particular. */
export async function resolveChatChannelRole(
  prisma: PrismaClient,
  channelId: string,
  ownerUserId: string,
  userId: string,
): Promise<'owner' | 'moderator' | null> {
  if (userId === ownerUserId) return 'owner'
  const mod = await prisma.channelModerator.findUnique({
    where: { channelId_userId: { channelId, userId } },
    select: { id: true },
  })
  return mod ? 'moderator' : null
}
