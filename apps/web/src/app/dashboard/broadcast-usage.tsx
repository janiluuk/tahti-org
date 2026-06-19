// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'

type WarningLevel = 'none' | '45m' | '55m' | 'grace' | 'blocked'

export type BroadcastUsage = {
  unlimited: boolean
  secondsUsed: number
  secondsRemaining: number | null
  warnings: number[]
  warningLevel?: WarningLevel
  atCap: boolean
  inGrace?: boolean
  blocked?: boolean
  showUpgradeCta?: boolean
  weeklyCapSeconds: number
}

function fmtMinutes(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function resolveWarningLevel(usage: BroadcastUsage): WarningLevel {
  if (usage.warningLevel) return usage.warningLevel
  if (usage.blocked) return 'blocked'
  if (usage.inGrace) return 'grace'
  if (usage.warnings.includes(55 * 60)) return '55m'
  if (usage.warnings.includes(45 * 60)) return '45m'
  return 'none'
}

export default function BroadcastUsageBanner({ usage }: { usage: BroadcastUsage | null }) {
  if (!usage || usage.unlimited) return null

  const cap = usage.weeklyCapSeconds
  const used = usage.secondsUsed
  const pct = Math.min(100, Math.round((used / cap) * 100))
  const level = resolveWarningLevel(usage)
  const nearCap = level !== 'none'

  const fillClass =
    level === 'blocked'
      ? 'studio-stat-box-fill studio-stat-box-fill--blocked'
      : nearCap
        ? 'studio-stat-box-fill studio-stat-box-fill--warn'
        : 'studio-stat-box-fill'

  return (
    <div className={`studio-stat-box${nearCap ? ' studio-stat-box--warn' : ''}`}>
      <div className="studio-stat-box-header">
        <span className="studio-stat-box-title">Weekly live broadcasting</span>
        <span
          className={`studio-text-sm${level === 'blocked' ? ' studio-text-error' : ' studio-text-muted-sm'}`}
        >
          {fmtMinutes(used)} / {fmtMinutes(cap)}
        </span>
      </div>
      <div className="studio-stat-box-track">
        <div className={fillClass} style={{ ['--studio-stat-pct' as string]: `${pct}%` }} />
      </div>
      {level === 'grace' ? (
        <p className="studio-text-warn studio-mt-sm">
          Weekly hour reached — wrapping up live (about a minute). Archive plays until Monday 00:00
          UTC.
        </p>
      ) : level === 'blocked' ? (
        <p className="studio-text-warn studio-mt-sm">
          Your weekly hour is up — archive plays until Monday 00:00 UTC.{' '}
          <Link href="/help/tier-limits">Free vs paid limits</Link>
          {' · '}
          <Link href="/dashboard#membership">View membership →</Link>
        </p>
      ) : level === '55m' ? (
        <p className="studio-text-warn studio-mt-sm">
          You&apos;ve broadcast 55 minutes this week — 5 minutes left until Monday.
        </p>
      ) : level === '45m' ? (
        <p className="studio-text-warn studio-mt-sm">
          You&apos;ve broadcast 45 minutes this week — 15 minutes left until Monday.
        </p>
      ) : null}
    </div>
  )
}
