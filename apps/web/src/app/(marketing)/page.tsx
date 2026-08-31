// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ChannelCard, DiscoWidgetRenderItem } from '@tahti/shared'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { BrandLogo, ButtonIcon, StatCard, StatCardStrip } from '@tahti/ui'
import { getSessionUser } from '@/lib/session'
import { isSignupOpen } from '@/lib/signup'
import { resolveChannelUrl } from '@/lib/app-url'
import { DiscoWidgetFrame } from '@/components/disco-widgets/disco-widget-frame'
import { IdleAutoScroll } from './_idle-auto-scroll'
import { DevLinks } from './_dev-links'

interface PlatformStats {
  activeArtists: number
  broadcastsThisMonth: number
  totalHours: number
}

interface NewsPost {
  id: string
  headline: string
  summary: string
  authorName: string
  publishedAt: string
}

async function fetchData(): Promise<{
  live: ChannelCard[]
  stats: PlatformStats | null
  news: NewsPost[]
  discoWidgets: DiscoWidgetRenderItem[]
}> {
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  try {
    const [channelsRes, statsRes, newsRes, discoWidgetsRes] = await Promise.all([
      fetch(`${apiUrl}/api/v1/channels`, { next: { revalidate: 30, tags: ['channels-live'] } }),
      fetch(`${apiUrl}/api/v1/stats`, { next: { revalidate: 300 } }),
      fetch(`${apiUrl}/api/v1/news`, { next: { revalidate: 60, tags: ['news-feed'] } }),
      fetch(`${apiUrl}/api/v1/disco-widgets/homepage`, { next: { revalidate: 60 } }),
    ])
    const channels = channelsRes.ok
      ? ((await channelsRes.json()) as { live: ChannelCard[]; recent: ChannelCard[] })
      : { live: [], recent: [] }
    const stats = statsRes.ok ? ((await statsRes.json()) as PlatformStats) : null
    const news = newsRes.ok ? ((await newsRes.json()) as NewsPost[]) : []
    const discoWidgets = discoWidgetsRes.ok
      ? ((await discoWidgetsRes.json()) as { widgets: DiscoWidgetRenderItem[] }).widgets
      : []
    return { live: channels.live, stats, news, discoWidgets }
  } catch {
    return { live: [], stats: null, news: [], discoWidgets: [] }
  }
}

function formatNewsDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function LiveTile({ channel }: { channel: ChannelCard }) {
  return (
    <div className="listen-live-card">
      {/* "Stretched link" covering the whole card — the primary click target
          (go listen). .listen-live-card__handle below sits in normal flow on
          top of it (position: relative + higher z-index in CSS) so it stays
          independently clickable to the artist's profile instead of being
          swallowed by this overlay; nesting an <a> inside this one would be
          invalid HTML and unreliable to click. */}
      <Link
        href={resolveChannelUrl(channel.slug)}
        className="listen-live-card__listen-link"
        aria-label={`Listen to ${channel.user.displayName}`}
      />
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
        <Link href={`/u/${channel.user.username}`} className="listen-live-card__handle">
          @{channel.user.username}
        </Link>
      </div>
      <div className="listen-live-card__cta">Listen →</div>
    </div>
  )
}

function formatHours(h: number): string {
  if (h >= 1000) return `${(h / 1000).toFixed(1)}k`
  return String(h)
}

function hasMeaningfulPlatformStats(stats: PlatformStats): boolean {
  return stats.activeArtists > 0 || stats.broadcastsThisMonth > 0 || stats.totalHours > 0
}

export default async function HomePage({ searchParams }: { searchParams?: { home?: string } }) {
  const [{ live, stats, news, discoWidgets }, user] = await Promise.all([
    fetchData(),
    getSessionUser(),
  ])

  // Logged-in artists land in the studio (Artist panel) by default. Explicit
  // Home nav uses ?home=1 so they can still reach the marketing page.
  if (user?.hasChannel && searchParams?.home !== '1') {
    redirect('/dashboard')
  }

  return (
    <div className="home-shell">
      <IdleAutoScroll />
      <section className="home-hero" data-scroll-section>
        <BrandLogo />
        <h1 className="home-title">
          Broadcasting for
          <br />
          independent artists.
        </h1>
        <p className="home-sub">A nonprofit platform built to support artists — not algorithms.</p>
        <div className="home-ctas">
          <Link
            href="https://beta.tahti.live"
            className="ui-btn ui-btn--primary ui-btn--lg home-cta-primary"
          >
            <ButtonIcon name="play" />
            Try new beta!
          </Link>
          {!user && isSignupOpen() && (
            <Link href="/signup" className="ui-btn ui-btn--secondary ui-btn--lg">
              Join as an artist
            </Link>
          )}
          {!user && (
            <Link href="/login" className="ui-btn ui-btn--secondary ui-btn--lg">
              Sign in
            </Link>
          )}
          {user?.hasChannel && (
            <Link href="/dashboard" className="ui-btn ui-btn--primary ui-btn--lg">
              Artist panel
            </Link>
          )}
          <Link href="/about" className="ui-btn ui-btn--secondary ui-btn--lg">
            About Tahti
          </Link>
        </div>
      </section>

      <section className="home-live-section" data-scroll-section>
        <div className="home-section-label">
          <span className="listen-live-dot" aria-hidden />
          On air right now
        </div>
        {live.length > 0 ? (
          <>
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
          </>
        ) : (
          <div className="public-empty-card">
            <p className="public-empty-card__text">No one is live right now.</p>
            <p className="public-empty-card__hint">
              <Link href="/listen">Browse channels</Link>
              {' · '}
              <Link href="/radio">Tahti Radio</Link>
            </p>
          </div>
        )}
      </section>

      {news.length > 0 && (
        <section
          className="home-news-section"
          aria-labelledby="home-news-heading"
          data-scroll-section
        >
          <div className="home-section-label" id="home-news-heading">
            News
          </div>
          <ul className="home-news-list">
            {news.map((post) => (
              <li key={post.id} className="home-news-item">
                <p className="home-news-item__date">{formatNewsDate(post.publishedAt)}</p>
                <h3 className="home-news-item__headline">{post.headline}</h3>
                <p className="home-news-item__summary">{post.summary}</p>
                <p className="home-news-item__byline">By {post.authorName}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {discoWidgets.length > 0 && (
        <section className="home-news-section" data-scroll-section>
          {discoWidgets.map((w) => (
            <DiscoWidgetFrame
              key={w.installId}
              sandboxUrl={w.sandboxUrl}
              name={w.name}
              context={w.context}
              config={w.config}
            />
          ))}
        </section>
      )}

      {stats && hasMeaningfulPlatformStats(stats) && (
        <div data-scroll-section>
          <StatCardStrip aria-label="Platform stats">
            <StatCard
              layout="inline"
              variant="neutral"
              value={String(stats.activeArtists)}
              label="active artists"
            />
            <StatCard
              layout="inline"
              variant="neutral"
              value={String(stats.broadcastsThisMonth)}
              label="broadcasts this month"
            />
            <StatCard
              layout="inline"
              variant="neutral"
              value={`${formatHours(stats.totalHours)} h`}
              label="broadcast in total"
            />
          </StatCardStrip>
        </div>
      )}

      <DevLinks />
    </div>
  )
}
