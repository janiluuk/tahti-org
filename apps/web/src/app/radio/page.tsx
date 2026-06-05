// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Metadata } from 'next'
import { BrandLogo } from '@tahti/ui'
import { BgCanvas } from '@/components/ui/bg-canvas'

export const revalidate = 30

export const metadata: Metadata = {
  title: 'Tahti Radio — live meta-stream',
  description: 'Fair-rotation relay of member channels currently broadcasting live on Tahti.',
}

interface RadioChannel {
  slug: string
  artistName: string
  hlsUrl?: string
}

interface RadioNowPlaying {
  live: boolean
  channel: RadioChannel | null
}

interface RadioHistoryItem {
  slug: string
  artistName: string
  featuredAt: string
}

async function fetchRadio(): Promise<RadioNowPlaying> {
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  try {
    const res = await fetch(`${apiUrl}/api/v1/radio`, { next: { revalidate: 30 } })
    if (!res.ok) return { live: false, channel: null }
    return (await res.json()) as RadioNowPlaying
  } catch {
    return { live: false, channel: null }
  }
}

async function fetchHistory(): Promise<RadioHistoryItem[]> {
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  try {
    const res = await fetch(`${apiUrl}/api/v1/radio/history`, { next: { revalidate: 60 } })
    if (!res.ok) return []
    return (await res.json()) as RadioHistoryItem[]
  } catch {
    return []
  }
}

function formatFeaturedAt(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default async function RadioPage() {
  const [now, history] = await Promise.all([fetchRadio(), fetchHistory()])

  return (
    <>
      <BgCanvas />
      <div className="listen-shell">
        <header className="listen-header">
          <BrandLogo />
          <div className="listen-header__text">
            <h1 className="listen-header__title">Tahti Radio</h1>
            <p className="listen-header__sub">
              Fair-rotation meta-stream — when members are live, one channel at a time, no editorial
              picks.
            </p>
          </div>
          <div className="listen-header__meta">
            <a href="/listen" className="listen-radio-link">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path
                  d="M10 3L5 8l5 5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              All channels
            </a>
          </div>
        </header>

        <section className="listen-section">
          <div className={`listen-section__label${now.live ? ' listen-section__label--live' : ''}`}>
            {now.live && <span className="listen-live-dot" aria-hidden />}
            Now playing
          </div>

          {now.live && now.channel ? (
            <div className="radio-now-card">
              <div className="radio-now-card__avatar">
                <span className="radio-now-card__initial" aria-hidden>
                  {now.channel.artistName.charAt(0).toUpperCase()}
                </span>
                <span className="signal-dot radio-now-card__pulse" aria-hidden />
              </div>
              <div className="radio-now-card__body">
                <div className="radio-now-card__name">{now.channel.artistName}</div>
                <div className="radio-now-card__badge">Live on Tahti Radio</div>
              </div>
              <a href={`/c/${now.channel.slug}`} className="radio-now-card__cta">
                Open channel →
              </a>
            </div>
          ) : (
            <div className="radio-offline">
              <span className="radio-offline__dot" aria-hidden />
              No member channel is live right now — check back soon.
            </div>
          )}
        </section>

        {history.length > 0 && (
          <section className="listen-section">
            <div className="listen-section__label">Recently featured</div>
            <div className="radio-history">
              {history.map((item) => (
                <a
                  key={`${item.slug}-${item.featuredAt}`}
                  href={`/c/${item.slug}`}
                  className="radio-history-item"
                >
                  <span className="radio-history-item__name">{item.artistName}</span>
                  <span className="radio-history-item__time">
                    {formatFeaturedAt(item.featuredAt)}
                  </span>
                </a>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  )
}
