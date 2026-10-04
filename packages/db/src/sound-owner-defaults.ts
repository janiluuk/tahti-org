// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@prisma/client'

export type SoundOwnerDefaults = { commentsEnabled: boolean; topListsEligible: boolean }

export function soundDefaultsFromOwner(owner: {
  defaultTrackCommentsEnabled: boolean
  topListsOptOut: boolean
}): SoundOwnerDefaults {
  return {
    commentsEnabled: owner.defaultTrackCommentsEnabled,
    topListsEligible: !owner.topListsOptOut,
  }
}

/** The owner's account settings a new Sound on `channelId` starts with; every
 * `sound.create` spreads this so imports and recordings honour them like uploads. */
export async function soundOwnerDefaults(
  prisma: Pick<PrismaClient, 'channel'>,
  channelId: string,
): Promise<SoundOwnerDefaults> {
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: { user: { select: { defaultTrackCommentsEnabled: true, topListsOptOut: true } } },
  })
  if (!channel) return { commentsEnabled: true, topListsEligible: true }
  return soundDefaultsFromOwner(channel.user)
}
