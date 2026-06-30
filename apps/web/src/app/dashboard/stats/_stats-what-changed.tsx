// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

type Props = {
  daily: Array<{ date: string; plays: number }>
  busiestDay: { date: string; plays: number } | null
}

function formatDay(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })
}

/** "What changed this period" — only renders when there's a genuine, real standout day.
 * Never fabricates a referrer or event we don't actually have data for. */
export function StatsWhatChanged({ daily, busiestDay }: Props) {
  if (!busiestDay || daily.length < 3) return null

  const total = daily.reduce((sum, d) => sum + d.plays, 0)
  const average = total / daily.length
  if (average <= 0 || busiestDay.plays < average * 2) return null

  const pctAboveAverage = Math.round(((busiestDay.plays - average) / average) * 100)

  return (
    <div className="stats-what-changed">
      <span className="stats-what-changed__label">What changed this period</span>
      <p className="stats-what-changed__body">
        <span className="stats-what-changed__dot" aria-hidden />
        {formatDay(busiestDay.date)} was your busiest day —{' '}
        <span className="stats-what-changed__accent">
          {busiestDay.plays.toLocaleString()} plays
        </span>
        , {pctAboveAverage}% above your period average.
      </p>
    </div>
  )
}
