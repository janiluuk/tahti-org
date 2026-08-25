// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Job } from 'bullmq'
import { prisma, notifyBoardOfMissedLiveShow } from '@tahti/db'

// Grace window before a passed start time counts as "missed" — artists
// legitimately run a few minutes late; this just needs to be shorter than
// the scan's own cadence (hourly) so nothing sits unflagged for long.
const GRACE_MINUTES = 30

/** Flags a ScheduledLiveShow as missed (creates a MissedLiveShowFlag +
 * notifies the board) when its start time has passed with no Broadcast
 * against it and no existing flag. Runs hourly — see
 * packages/shared/src/worker-cron-jobs.ts. */
export async function processMissedLiveShowScanJob(_job: Job): Promise<{ flagged: number }> {
  const cutoff = new Date(Date.now() - GRACE_MINUTES * 60_000)

  const overdue = await prisma.scheduledLiveShow.findMany({
    where: {
      startAt: { lt: cutoff },
      canceledAt: null,
      broadcast: null,
      missedFlag: null,
    },
    select: {
      id: true,
      title: true,
      startAt: true,
      channelId: true,
      channel: { select: { user: { select: { displayName: true } } } },
    },
  })

  for (const show of overdue) {
    await prisma.missedLiveShowFlag.create({
      data: { scheduledLiveShowId: show.id, channelId: show.channelId },
    })
    await notifyBoardOfMissedLiveShow(
      prisma,
      { id: show.id, title: show.title, startAt: show.startAt },
      show.channel.user.displayName,
    )
  }

  return { flagged: overdue.length }
}
