// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Job } from 'bullmq'
import { prisma } from '@tahti/db'
import { fetchNowPlaying, parserForUrl } from '../lib/internet-radio-now-playing.js'

// Only re-fetch a station past this age — avoids hammering a station's site
// on every cron tick when nothing's actually stale yet. Matches the cron's
// own cadence (see internet-radio-now-playing-sync in worker-cron-jobs.ts),
// so in steady state every eligible station refreshes roughly once per tick.
const STALE_AFTER_MS = 10 * 60 * 1000

export async function processInternetRadioNowPlayingSyncJob(
  _job: Job,
): Promise<{ checked: number; updated: number }> {
  const cutoff = new Date(Date.now() - STALE_AFTER_MS)

  // Only stations a user has actually added (this table has no "unadded
  // preset" rows at all — InternetRadioPreset is the separate catalog) —
  // and only ones whose host we can actually parse, to avoid a wasted
  // fetch-then-discard on every tick for the rest.
  const stations = await prisma.internetRadioStation.findMany({
    where: {
      programmingUrl: { not: null },
      OR: [{ currentProgramFetchedAt: null }, { currentProgramFetchedAt: { lt: cutoff } }],
    },
    select: { id: true, programmingUrl: true },
  })

  let updated = 0
  for (const station of stations) {
    if (!station.programmingUrl || !parserForUrl(station.programmingUrl)) continue
    const nowPlaying = await fetchNowPlaying(station.programmingUrl)
    await prisma.internetRadioStation.update({
      where: { id: station.id },
      data: {
        currentProgramTitle: nowPlaying?.title ?? null,
        currentProgramArtist: nowPlaying?.artist ?? null,
        currentProgramFetchedAt: new Date(),
      },
    })
    updated++
  }

  return { checked: stations.length, updated }
}
