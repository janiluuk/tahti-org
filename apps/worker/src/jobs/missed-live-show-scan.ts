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
 * against it and no existing flag. Also auto-resolves any still-open flag
 * whose show has since been linked to a Broadcast — the go-live flow
 * (apps/api's ensurePlannedShowFilled) links a broadcast to a
 * ScheduledLiveShow up to 12 hours after its scheduled start, well past
 * this job's 30-minute grace window, so an artist running late enough to
 * get flagged but still going live shouldn't leave a stale flag sitting in
 * the admin queue forever. Runs hourly — see
 * packages/shared/src/worker-cron-jobs.ts. */
export async function processMissedLiveShowScanJob(
  _job: Job,
): Promise<{ flagged: number; autoResolved: number }> {
  const cutoff = new Date(Date.now() - GRACE_MINUTES * 60_000)

  const autoResolved = await prisma.missedLiveShowFlag.updateMany({
    where: {
      status: { in: ['OPEN', 'REVIEWING'] },
      scheduledLiveShow: { broadcast: { isNot: null } },
    },
    data: {
      status: 'DISMISSED',
      resolutionNote: 'Auto-resolved: the artist went live for this show after all.',
      resolvedAt: new Date(),
    },
  })

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

  if (overdue.length > 0) {
    const boardMembers = await prisma.user.findMany({
      where: { isBoard: true },
      select: { id: true },
    })
    const boardMemberIds = boardMembers.map((m) => m.id)

    for (const show of overdue) {
      await prisma.missedLiveShowFlag.create({
        data: { scheduledLiveShowId: show.id, channelId: show.channelId },
      })
      await notifyBoardOfMissedLiveShow(
        prisma,
        { id: show.id, title: show.title, startAt: show.startAt },
        show.channel.user.displayName,
        boardMemberIds,
      )
    }
  }

  return { flagged: overdue.length, autoResolved: autoResolved.count }
}
