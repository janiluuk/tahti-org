// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { StatCard, StatCardGrid } from '@tahti/ui'

type Props = {
  bestTrack: { title: string; plays: number } | null
  bestCountry: { country: string; count: number } | null
  busiestDay: { date: string; plays: number } | null
}

function formatDay(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

/** Three cards, not ten — the single best track, country, and day, instead of long ranked lists. */
export function StatsTopThree({ bestTrack, bestCountry, busiestDay }: Props) {
  if (!bestTrack && !bestCountry && !busiestDay) return null

  return (
    <StatCardGrid cols={3} aria-label="Top performers">
      {bestTrack && (
        <StatCard
          variant="plays"
          value={bestTrack.plays.toLocaleString()}
          label="plays"
          subtitle={bestTrack.title}
        />
      )}
      {bestCountry && (
        <StatCard
          variant="neutral"
          value={bestCountry.count.toLocaleString()}
          label="best country"
          subtitle={bestCountry.country}
        />
      )}
      {busiestDay && (
        <StatCard
          variant="plays"
          value={busiestDay.plays.toLocaleString()}
          label="busiest day"
          subtitle={formatDay(busiestDay.date)}
        />
      )}
    </StatCardGrid>
  )
}
