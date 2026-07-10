// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ChannelCard } from '@tahti/shared'
import { ListenChannels } from './_listen-channels'

async function fetchChannels(): Promise<{ live: ChannelCard[]; recent: ChannelCard[] }> {
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  try {
    const res = await fetch(`${apiUrl}/api/v1/channels`, {
      next: { revalidate: 30, tags: ['channels-live'] },
    })
    if (!res.ok) return { live: [], recent: [] }
    return (await res.json()) as { live: ChannelCard[]; recent: ChannelCard[] }
  } catch {
    return { live: [], recent: [] }
  }
}

export default async function ListenPage() {
  const { live, recent } = await fetchChannels()
  const empty = live.length === 0 && recent.length === 0

  return (
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
        <div className="public-empty-card">
          <p className="public-empty-card__text">No channels live right now.</p>
          <p className="public-empty-card__hint">
            Check back later, or tune in to <a href="/radio">Tahti Radio</a> — archived sets on fair
            rotation.
          </p>
        </div>
      ) : (
        <ListenChannels live={live} recent={recent} />
      )}
    </div>
  )
}
