// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { availableUserWhere, type PrismaClient } from '@tahti/db'
import { userName } from './safe-names.js'
import { isBlockedEitherWay } from './user-blocks.js'

/** Tells a member the host invited them into the green room of the live
 * broadcast, linking to the guest view — the invite only works while the
 * show is on, so it can't wait for the guest to look. Never throws. */
export async function notifyGreenRoomGuest(
  prisma: PrismaClient,
  invite: { guestId: string; hostId: string },
  log: { warn: (obj: unknown, msg: string) => void },
): Promise<void> {
  try {
    const [guest, host] = await Promise.all([
      prisma.user.findFirst({
        where: { id: invite.guestId, ...availableUserWhere },
        select: { id: true },
      }),
      prisma.user.findUnique({
        where: { id: invite.hostId },
        select: { username: true, displayName: true },
      }),
    ])
    if (!guest || !host) return
    if (await isBlockedEitherWay(prisma, invite.guestId, invite.hostId)) return
    await prisma.notification.create({
      data: {
        userId: guest.id,
        type: 'GREEN_ROOM_INVITE',
        actorUserId: invite.hostId,
        title: `${userName(host)} invited you to their green room`,
        body: 'Join while the broadcast is live.',
        url: `/u/${host.username}/green-room`,
      },
    })
  } catch (err) {
    log.warn({ err }, 'green room invite notice failed')
  }
}
