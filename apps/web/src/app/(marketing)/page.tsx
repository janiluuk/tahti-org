// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ChannelCard } from '@tahti/shared'
import Link from 'next/link'
import { BrandLogo } from '@tahti/ui'

interface PlatformStats {
  activeArtists: number
  broadcastsThisMonth: number
  totalHours: number
}

async function fetchData(): Promise<{
  live: ChannelCard[]
  stats: PlatformStats | null
}> {
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  try {
    const [channelsRes, statsRes] = await Promise.all([
      fetch(`${apiUrl}/api/v1/channels`, { next: { revalidate: 30 } }),
      fetch(`${apiUrl}/api/v1/stats`, { next: { revalidate: 300 } }),
    ])
    const channels = channelsRes.ok
      ? ((await channelsRes.json()) as { live: ChannelCard[]; recent: ChannelCard[] })
      : { live: [], recent: [] }
    const stats = statsRes.ok ? ((await statsRes.json()) as PlatformStats) : null
    return { live: channels.live, stats }
  } catch {
    return { live: [], stats: null }
  }
}

function LiveTile({ channel }: { channel: ChannelCard }) {
  return (
    <a href={`/c/${channel.slug}`} className="listen-live-card">
      <div className="listen-live-card__avatar">
        {channel.user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={channel.user.avatarUrl} alt={channel.user.displayName} />
        ) : (
          <span className="listen-live-card__avatar-fallback">
            {channel.user.displayName.charAt(0).toUpperCase()}
          </span>
        )}
        <span className="listen-live-card__pulse" aria-hidden />
      </div>
      <div className="listen-live-card__body">
        <div className="listen-live-card__live-badge">
          <span className="listen-live-dot" />
          Live now
        </div>
        <div className="listen-live-card__name">{channel.user.displayName}</div>
        <div className="listen-live-card__handle">@{channel.user.username}</div>
      </div>
      <div className="listen-live-card__cta">Listen →</div>
    </a>
  )
}

function StatPill({ value, label }: { value: string; label: string }) {
  return (
    <div className="home-stat">
      <span className="home-stat__value">{value}</span>
      <span className="home-stat__label">{label}</span>
    </div>
  )
}

function formatHours(h: number): string {
  if (h >= 1000) return `${(h / 1000).toFixed(1)}k`
  return String(h)
}

export default async function HomePage() {
  const { live, stats } = await fetchData()

  return (
    <div className="home-shell">
      <section className="home-hero">
        <BrandLogo />
        <h1 className="home-title">
          Broadcasting for
          <br />
          independent artists.
        </h1>
        <p className="home-sub">A nonprofit platform built to support artists — not algorithms.</p>
        <div className="home-ctas">
          <Link href="/listen" className="ui-btn ui-btn--primary ui-btn--lg home-cta-primary">
            Listen now
          </Link>
          <Link href="/login" className="ui-btn ui-btn--secondary ui-btn--lg">
            Sign in
          </Link>
        </div>
      </section>

      {live.length > 0 && (
        <section className="home-live-section">
          <div className="home-section-label">
            <span className="listen-live-dot" aria-hidden />
            On air right now
          </div>
          <div className="listen-live-grid">
            {live.map((ch) => (
              <LiveTile key={ch.slug} channel={ch} />
            ))}
          </div>
          <div className="home-live-more">
            <Link href="/listen" className="home-live-more__link">
              See all channels →
            </Link>
          </div>
        </section>
      )}

      {stats && (
        <section className="home-stats" aria-label="Platform stats">
          <StatPill value={String(stats.activeArtists)} label="active artists" />
          <div className="home-stats__sep" aria-hidden />
          <StatPill value={String(stats.broadcastsThisMonth)} label="broadcasts this month" />
          <div className="home-stats__sep" aria-hidden />
          <StatPill value={`${formatHours(stats.totalHours)} h`} label="broadcast in total" />
        </section>
      )}
    </div>
  )
}
