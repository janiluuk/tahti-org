// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { availableUserWhere, type PrismaClient } from '@tahti/db'

/** Tells an account the board removed something it made — a track from
 * Admin → Files, or a comment — so it doesn't just vanish. Silent when a
 * board member removes their own. Never throws: the removal is done. */
export async function notifyOfBoardRemoval(
  prisma: PrismaClient,
  removal: { ownerId: string; actorId: string; title: string; url: string },
  log: { warn: (obj: unknown, msg: string) => void },
): Promise<void> {
  if (removal.ownerId === removal.actorId) return
  try {
    const owner = await prisma.user.findFirst({
      where: { id: removal.ownerId, ...availableUserWhere },
      select: { id: true },
    })
    if (!owner) return
    await prisma.notification.create({
      data: {
        userId: owner.id,
        type: 'CONTENT_REMOVED_BY_BOARD',
        title: removal.title,
        body: 'Ask the board through Help → Support if you think this was a mistake.',
        url: removal.url,
      },
    })
  } catch (err) {
    log.warn({ err }, 'board removal notice failed')
  }
}
