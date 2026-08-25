// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Job } from 'bullmq'
import { prisma, generateForSeries, syncNextBroadcast } from '@tahti/db'
import { isValidRecurrenceRule, nextRecurrenceOccurrences } from '@tahti/shared'

/** Daily cron: rolls every recurrence-enabled series' generated episodes
 * forward so the horizon never runs dry between artist visits to the
 * dashboard. The immediate pass on save (apps/api's channel-schedule route)
 * covers the common case; this catches series nobody has revisited. */
export async function processLiveShowRecurrenceJob(_job: Job): Promise<{
  seriesProcessed: number
  episodesCreated: number
}> {
  const series = await prisma.liveShowSeries.findMany({
    where: { recurrenceEnabled: true },
    include: { channel: { select: { userId: true } } },
  })
  const now = new Date()
  const touchedChannels = new Set<string>()
  let episodesCreated = 0

  for (const s of series) {
    const rule = {
      days: s.recurrenceDays,
      timeOfDay: s.recurrenceTimeOfDay,
      timezone: s.recurrenceTimezone,
    }
    if (!isValidRecurrenceRule(rule)) continue
    const occurrences = nextRecurrenceOccurrences(rule, now, s.recurrenceHorizonDays)
    const created = await generateForSeries(prisma, { ...s, userId: s.channel.userId }, occurrences)
    episodesCreated += created
    if (created > 0) touchedChannels.add(s.channelId)
  }

  for (const channelId of touchedChannels) {
    await syncNextBroadcast(prisma, channelId)
  }

  return { seriesProcessed: series.length, episodesCreated }
}
