// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'
import { createClient } from 'redis'

/** A host's player pushes the jam state on every play, pause, seek and track
 * change, so a jam with no push for this long has nobody running it: the
 * host closed the tab or lost the connection without leaving. */
export const JAM_IDLE_AFTER_MS = 6 * 60 * 60_000

/** Same channel prefix as `apps/api/src/lib/jam-broadcast.ts`, so guests'
 * event streams get the `ended` event and close. */
const JAM_CHANNEL_PREFIX = 'jam:'

export interface JamExpireSummary {
  ended: number
}

type JamPublisher = (sessionId: string, event: { type: 'ended' }) => Promise<void>

async function publishWithRedis(sessionIds: string[]): Promise<void> {
  const client = createClient({ url: process.env.REDIS_URL ?? 'redis://localhost:6379' })
  await client.connect()
  try {
    for (const id of sessionIds) {
      await client.publish(JAM_CHANNEL_PREFIX + id, JSON.stringify({ type: 'ended' }))
    }
  } finally {
    await client.disconnect()
  }
}

/** Ends jams whose host stopped pushing state, and tells anyone still
 * connected. Run hourly by the jam-session-expire cron. */
export async function expireAbandonedJams(
  prisma: Pick<PrismaClient, 'jamSession'>,
  now: Date = new Date(),
  publish?: JamPublisher,
): Promise<JamExpireSummary> {
  const idleBefore = new Date(now.getTime() - JAM_IDLE_AFTER_MS)
  const stale = await prisma.jamSession.findMany({
    where: { endedAt: null, positionUpdatedAt: { lt: idleBefore } },
    select: { id: true },
    take: 500,
  })
  if (stale.length === 0) return { ended: 0 }

  const ids = stale.map((s) => s.id)
  const { count } = await prisma.jamSession.updateMany({
    where: { id: { in: ids }, endedAt: null, positionUpdatedAt: { lt: idleBefore } },
    data: { endedAt: now, isPlaying: false },
  })
  if (publish) {
    for (const id of ids) await publish(id, { type: 'ended' })
  } else {
    await publishWithRedis(ids)
  }
  return { ended: count }
}
