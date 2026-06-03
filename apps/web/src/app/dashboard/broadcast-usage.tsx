// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

interface BroadcastUsage {
  unlimited: boolean
  secondsUsed: number
  secondsRemaining: number | null
  warnings: number[]
  atCap: boolean
  inGrace?: boolean
  blocked?: boolean
  showUpgradeCta?: boolean
  weeklyCapSeconds: number
  warningLevel?: '45m' | '55m' | 'grace' | null
}

function fmtMinutes(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function BroadcastUsageBanner({ usage }: { usage: BroadcastUsage | null }) {
  if (!usage || usage.unlimited) return null

  const cap = usage.weeklyCapSeconds
  const used = usage.secondsUsed
  const pct = Math.min(100, Math.round((used / cap) * 100))
  const nearCap = usage.warnings.length > 0 || usage.atCap

  return (
    <div
      style={{
        marginTop: '1rem',
        padding: '1rem 1.5rem',
        border: `1px solid ${nearCap ? '#fbbf24' : '#eee'}`,
        borderRadius: 8,
        background: nearCap ? '#fffbeb' : '#fafafa',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <span style={{ fontWeight: 500, fontSize: '0.875rem' }}>Weekly live broadcasting</span>
        <span style={{ fontSize: '0.875rem', color: usage.atCap ? '#dc2626' : '#666' }}>
          {fmtMinutes(used)} / {fmtMinutes(cap)}
        </span>
      </div>
      <div style={{ background: '#f0f0f0', borderRadius: 4, height: 6, overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: usage.atCap ? '#dc2626' : '#2563eb',
            borderRadius: 4,
          }}
        />
      </div>
      {usage.warningLevel === 'grace' || usage.inGrace ? (
        <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: '#92400e' }}>
          Weekly hour reached — wrapping up live (about a minute). Archive plays until Monday 00:00
          UTC.
        </p>
      ) : usage.blocked ? (
        <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: '#92400e' }}>
          Your weekly hour is up — archive plays until Monday 00:00 UTC. Upgrade to unlimited live +
          lossless FLAC.
        </p>
      ) : usage.warningLevel === '55m' ? (
        <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: '#92400e' }}>
          You&apos;ve broadcast 55 minutes this week — 5 minutes left until Monday.
        </p>
      ) : usage.warningLevel === '45m' ? (
        <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: '#92400e' }}>
          You&apos;ve broadcast 45 minutes this week — 15 minutes left until Monday.
        </p>
      ) : null}
    </div>
  )
}
