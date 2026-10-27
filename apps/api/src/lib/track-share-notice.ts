// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { availableUserWhere, type PrismaClient } from '@tahti/db'
import { trackArtistName } from './safe-names.js'
import { isBlockedEitherWay } from './user-blocks.js'

/** Tells the member a track was shared with by name, with the keyed link,
 * so a private share doesn't depend on the artist sending the URL around.
 * Nothing when either side blocked the other. Never throws. */
export async function notifyGranteeOfShare(
  prisma: PrismaClient,
  share: { soundId: string; token: string; granteeUsername: string; sharerId: string },
  log: { warn: (obj: unknown, msg: string) => void },
): Promise<void> {
  try {
    const [grantee, sound] = await Promise.all([
      prisma.user.findFirst({
        where: { username: share.granteeUsername, ...availableUserWhere },
        select: { id: true },
      }),
      prisma.sound.findUnique({
        where: { id: share.soundId },
        select: {
          title: true,
          artistName: true,
          channel: { select: { user: { select: { username: true, displayName: true } } } },
        },
      }),
    ])
    if (!grantee || !sound || grantee.id === share.sharerId) return
    if (await isBlockedEitherWay(prisma, grantee.id, share.sharerId)) return
    await prisma.notification.create({
      data: {
        userId: grantee.id,
        type: 'TRACK_SHARED',
        actorUserId: share.sharerId,
        title: `${trackArtistName(sound)} shared "${sound.title}" with you`,
        url: `/t/${share.soundId}?key=${share.token}`,
      },
    })
  } catch (err) {
    log.warn({ err }, 'track share notice failed')
  }
}
