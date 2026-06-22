// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

type Props = {
  last7Plays: number
  prev7Plays: number
  hasEnoughHistory: boolean
}

function deltaSentence(last7: number, prev7: number, hasEnoughHistory: boolean): string | null {
  if (!hasEnoughHistory) return null
  if (prev7 === 0) return last7 > 0 ? 'All new activity this week.' : null
  const pct = Math.round(((last7 - prev7) / prev7) * 100)
  if (pct === 0) return 'Steady — same as the previous 7 days.'
  const arrow = pct > 0 ? '↑' : '↓'
  return `${arrow} ${Math.abs(pct)}% vs the previous 7 days.`
}

/** Stats page hero — this week's headline number, the one thing the artist should learn in 5 seconds. */
export function StatsHero({ last7Plays, prev7Plays, hasEnoughHistory }: Props) {
  const sentence = deltaSentence(last7Plays, prev7Plays, hasEnoughHistory)

  return (
    <div className="stats-hero">
      <div className="stats-hero__value">{last7Plays.toLocaleString()}</div>
      <div className="stats-hero__label">plays this week</div>
      {sentence && <p className="stats-hero__sentence">{sentence}</p>}
    </div>
  )
}
