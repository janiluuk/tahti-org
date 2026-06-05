// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ChannelCard } from '@tahti/shared'
import { BrandLogo, Heading, Text } from '@tahti/ui'
import { BgCanvas } from '@/components/ui/bg-canvas'

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
  const { live, recent } = await fetchChannels()
  const empty = live.length === 0 && recent.length === 0

  return (
    <>
      <BgCanvas />
      <div className="listen-shell">
        <header className="listen-header">
          <BrandLogo />
          <Heading level={1}>Listen</Heading>
          <Text tone="muted">Independent artists broadcasting live and on-demand.</Text>
          <p className="listen-header__meta">
            <a href="/radio">Tahti Radio</a> — fair-rotation meta-stream when members are live
          </p>
        </header>

        {empty ? (
          <div className="listen-empty">
            <Text tone="muted">No channels yet — check back soon.</Text>
          </div>
        ) : (
          <>
            {live.length > 0 && (
              <section className="listen-section">
                <div className="listen-section__label listen-section__label--live">● Live now</div>
                <div className="listen-grid">
                  {live.map((ch) => (
                    <ChannelCardItem key={ch.slug} channel={ch} />
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
