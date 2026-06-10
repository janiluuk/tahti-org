// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ChannelCard } from '@tahti/shared'
import { ChannelHeader } from '@tahti/ui'
import { BgCanvas } from '@/components/ui/bg-canvas'
import { getSessionUser } from '@/lib/session'

async function fetchChannels(): Promise<{ live: ChannelCard[]; recent: ChannelCard[] }> {
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  try {
    const res = await fetch(`${apiUrl}/api/v1/channels`, {
      next: { revalidate: 30 },
    })
    if (!res.ok) return { live: [], recent: [] }
    return (await res.json()) as { live: ChannelCard[]; recent: ChannelCard[] }
  } catch {
    return { live: [], recent: [] }
  }
}

function LiveCard({ channel }: { channel: ChannelCard }) {
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

function ChannelCardItem({ channel }: { channel: ChannelCard }) {
  const isLive = channel.state === 'LIVE'

  return (
    <a href={`/c/${channel.slug}`} className="listen-card">
      <div className="listen-card__avatar">
        {channel.user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={channel.user.avatarUrl} alt={channel.user.displayName} />
        ) : (
          <span className="listen-card__avatar-fallback">
            {channel.user.displayName.charAt(0).toUpperCase()}
          </span>
        )}
        {isLive && <span className="listen-card__live-dot" aria-label="Live now" />}
      </div>

      <div className="listen-card__body">
        <div className="listen-card__name">{channel.user.displayName}</div>
        <div className="listen-card__handle">@{channel.user.username}</div>
        {isLive ? (
          <div className="listen-card__status listen-card__status--live">● Live now</div>
        ) : channel.nextBroadcastNote ? (
          <div className="listen-card__status">{channel.nextBroadcastNote}</div>
        ) : channel.goneLiveAt ? (
          <div className="listen-card__status listen-card__status--muted">
            Last live{' '}
            {new Date(channel.goneLiveAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            })}
          </div>
        ) : null}
      </div>
    </a>
  )
}

export default async function ListenPage() {
  const [{ live, recent }, user] = await Promise.all([fetchChannels(), getSessionUser()])
  const empty = live.length === 0 && recent.length === 0

  return (
    <>
      <BgCanvas />
      <ChannelHeader activeNav="discover" user={user} />
      <div className="listen-shell">
        <header className="listen-page-header">
          <h1 className="listen-page-title">Discover</h1>
          <p className="listen-page-sub">Independent artists broadcasting live and on-demand.</p>
          <div className="listen-header__meta">
            <a href="/radio" className="listen-radio-link">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path
                  d="M2 11 Q8 5 14 11"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <path
                  d="M4.5 13 Q8 9 11.5 13"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <circle cx="8" cy="7" r="1.5" fill="currentColor" />
              </svg>
              Tahti Radio
            </a>
            <span className="listen-header__meta-sep">·</span>
            <span>fair-rotation meta-stream</span>
          </div>
        </header>

        {empty ? (
          <div className="listen-empty">
            <p className="listen-empty__text">No channels live right now.</p>
            <p className="listen-empty__hint">
              Check back later, or tune in to{' '}
              <a href="/radio" className="listen-radio-link">
                Tahti Radio
              </a>{' '}
              — it plays archived sets from all artists on rotation.
            </p>
          </div>
        ) : (
          <>
            {live.length > 0 && (
              <section className="listen-section">
                <div className="listen-section__label listen-section__label--live">
                  <span className="listen-live-dot" />
                  Live now
                </div>
                <div className="listen-live-grid">
                  {live.map((ch) => (
                    <LiveCard key={ch.slug} channel={ch} />
                  ))}
                </div>
              </section>
            )}

            {recent.length > 0 && (
              <section className="listen-section">
                <div className="listen-section__label">Recently active</div>
                <div className="listen-grid">
                  {recent.map((ch) => (
                    <ChannelCardItem key={ch.slug} channel={ch} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </>
  )
}
