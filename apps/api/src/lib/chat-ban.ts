// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'

/** True when this account was banned from the channel's chat. A ban set on a
 * signed-in sender's message names their account, so it holds on another
 * network, in another browser and in the fan room. */
export async function isAccountChatBanned(
  prisma: PrismaClient,
  channelId: string,
  userId: string,
): Promise<boolean> {
  const ban = await prisma.chatBan.findFirst({
    where: { channelId, userId },
    select: { id: true },
  })
  return ban !== null
}
