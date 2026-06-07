// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// M27 — resolves whether a user may moderate a channel's chat: either as the
// owning artist or as a moderator the owner has delegated to.

import type { PrismaClient } from '@tahti/db'

export interface ModeratedChannel {
  id: string
  slug: string
  isOwner: boolean
}

export async function resolveChannelForModeration(
  prisma: PrismaClient,
  slug: string,
  userId: string,
): Promise<ModeratedChannel | null> {
  const channel = await prisma.channel.findUnique({
    where: { slug },
    select: { id: true, slug: true, userId: true },
  })
  if (!channel) return null
  if (channel.userId === userId) return { id: channel.id, slug: channel.slug, isOwner: true }

  const moderator = await prisma.channelModerator.findUnique({
    where: { channelId_userId: { channelId: channel.id, userId } },
    select: { id: true },
  })
  if (!moderator) return null

  return { id: channel.id, slug: channel.slug, isOwner: false }
}
