// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

type Props = {
  periodPlays: number
  prevPeriodPlays: number
  hasEnoughHistory: boolean
  periodLabel: string
  comparisonLabel: string
}

function deltaSentence(
  current: number,
  previous: number,
  hasEnoughHistory: boolean,
  comparisonLabel: string,
): string | null {
  if (!hasEnoughHistory) return null
  if (previous === 0) return current > 0 ? 'All new activity this period.' : null
  const pct = Math.round(((current - previous) / previous) * 100)
  if (pct === 0) return `Steady — same as ${comparisonLabel}.`
  const arrow = pct > 0 ? '↑' : '↓'
  return `${arrow} ${Math.abs(pct)}% vs ${comparisonLabel}.`
}

/** Stats page hero — this period's headline number, the one thing the artist should learn in 5 seconds. */
export function StatsHero({
  periodPlays,
  prevPeriodPlays,
  hasEnoughHistory,
  periodLabel,
  comparisonLabel,
}: Props) {
  const sentence = deltaSentence(periodPlays, prevPeriodPlays, hasEnoughHistory, comparisonLabel)

  return (
    <div className="stats-hero" data-hero>
      <div className="stats-hero__value">{periodPlays.toLocaleString()}</div>
      <div className="stats-hero__label">plays {periodLabel}</div>
      {sentence && <p className="stats-hero__sentence">{sentence}</p>}
    </div>
  )
}
