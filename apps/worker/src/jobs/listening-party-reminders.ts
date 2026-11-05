// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'
import { notifyListeningPartyStarting } from '@tahti/db'
import { safeDisplayName } from '@tahti/shared'

/** A party found more than this long after its start gets no "starting now"
 * reminder: after a worker outage, a late "it's starting" is wrong. */
export const REMINDER_GRACE_MS = 15 * 60 * 1000

export interface ListeningPartyReminderSummary {
  started: number
  told: number
}

/**
 * Sends the "starting now" reminders for parties that just started. Each
 * party is claimed by setting `remindersSentAt` first, so several workers
 * ticking at once send them once.
 */
export async function processListeningPartyRemindersJob(
  prisma: PrismaClient,
  now: Date = new Date(),
): Promise<ListeningPartyReminderSummary> {
  const parties = await prisma.listeningParty.findMany({
    where: {
      canceledAt: null,
      remindersSentAt: null,
      startAt: { lte: now, gte: new Date(now.getTime() - REMINDER_GRACE_MS) },
      reminders: { some: {} },
    },
    select: {
      id: true,
      startAt: true,
      release: { select: { title: true } },
      host: { select: { id: true, username: true, displayName: true } },
    },
  })

  const summary: ListeningPartyReminderSummary = { started: 0, told: 0 }
  for (const party of parties) {
    const claimed = await prisma.listeningParty.updateMany({
      where: { id: party.id, remindersSentAt: null },
      data: { remindersSentAt: now },
    })
    if (claimed.count === 0) continue
    summary.started += 1
    summary.told += await notifyListeningPartyStarting(
      prisma,
      {
        id: party.host.id,
        username: party.host.username,
        displayName: safeDisplayName(party.host.displayName, party.host.username),
      },
      { id: party.id, startAt: party.startAt, release: party.release },
    )
  }
  return summary
}
