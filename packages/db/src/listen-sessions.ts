// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@prisma/client'

/** A ListenSession is considered abandoned once this long has passed since
 * its last heartbeat. The client pings every 180s (HEARTBEAT_INTERVAL_SEC
 * in apps/web's player-context.tsx) — one missed tick's worth of grace on
 * top absorbs normal jitter (a slow request, a brief network blip) without
 * keeping genuinely-stopped sessions open for long. Keep this comfortably
 * above the client's ping interval if that ever changes. */
const STALE_AFTER_MS = 7 * 60_000

export interface CloseStaleListenSessionsSummary {
  closed: number
}

/** Closes any open ListenSession whose lastSeenAt has gone stale, setting
 * endedAt to that last-confirmed timestamp (not "now") so the recorded
 * duration reflects when the listener was actually last seen, not when
 * this job happened to run. Run every few minutes by the
 * listen-session-close cron. */
export async function closeStaleListenSessions(
  prisma: PrismaClient,
): Promise<CloseStaleListenSessionsSummary> {
  const staleBefore = new Date(Date.now() - STALE_AFTER_MS)

  const result = await prisma.$executeRaw`
    UPDATE "engagement"."ListenSession"
    SET "endedAt" = "lastSeenAt"
    WHERE "endedAt" IS NULL AND "lastSeenAt" < ${staleBefore}
  `

  return { closed: result }
}
