// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'

const HOUR = 60 * 60 * 1000

/** A release with one ready, streamable track, enough to host a party on. */
export async function createPartyRelease(prisma: PrismaClient, userId: string, title: string) {
  return prisma.release.create({
    data: {
      userId,
      title,
      type: 'ALBUM',
      releaseDate: new Date(Date.now() + 30 * 24 * HOUR),
      smartLinkSlug: `lp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      tracks: {
        create: [
          {
            position: 1,
            title: 'One',
            durationSec: 600,
            streamKey: 'streams/fixture-1.opus',
            status: 'READY',
          },
        ],
      },
    },
  })
}

/** A party row written directly, at any start time (the API only takes future ones). */
export async function insertParty(
  prisma: PrismaClient,
  host: { id: string; channelId: string },
  releaseId: string,
  startAt: Date,
  canceledAt: Date | null = null,
) {
  return prisma.listeningParty.create({
    data: { releaseId, channelId: host.channelId, hostUserId: host.id, startAt, canceledAt },
  })
}
