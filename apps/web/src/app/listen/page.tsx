// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ChannelCard } from '@tahti/shared'
import { TAHTI_RADIO_SLUG } from '@tahti/shared'
import Link from 'next/link'
import { ListenChannels } from './_listen-channels'
import { TahtiRadioCard } from './_tahti-radio-card'

const API_URL = process.env.API_URL ?? 'http://localhost:3001'

async function fetchChannels(): Promise<{ live: ChannelCard[]; recent: ChannelCard[] }> {
  try {
    const res = await fetch(`${API_URL}/api/v1/channels`, {
      next: { revalidate: 30, tags: ['channels-live'] },
    })
    if (!res.ok) return { live: [], recent: [] }
    return (await res.json()) as { live: ChannelCard[]; recent: ChannelCard[] }
  } catch {
    return { live: [], recent: [] }
  }
}

interface TahtiRadioPreview {
  hlsUrl: string | null
  title: string
  artistName: string | null
  artworkUrl: string | null
}

async function fetchTahtiRadioPreview(): Promise<TahtiRadioPreview> {
  try {
    const res = await fetch(`${API_URL}/api/channels/${TAHTI_RADIO_SLUG}`, {
      next: { revalidate: 30 },
    })
    if (!res.ok) return { hlsUrl: null, title: 'Tahti Radio', artistName: null, artworkUrl: null }
    const data = (await res.json()) as {
      hlsUrl: string | null
      nowPlaying: { title: string; artistName: string; artworkUrl: string | null } | null
    }
    return {
      hlsUrl: data.hlsUrl,
      title: data.nowPlaying?.title ?? 'Tahti Radio',
      artistName: data.nowPlaying?.artistName ?? null,
      artworkUrl: data.nowPlaying?.artworkUrl ?? null,
    }
  } catch {
    return { hlsUrl: null, title: 'Tahti Radio', artistName: null, artworkUrl: null }
  }
}

async function fetchListenerCount(slug: string): Promise<number> {
  try {
    const res = await fetch(`${API_URL}/api/channels/${slug}/presence`, { cache: 'no-store' })
    if (!res.ok) return 0
    const data = (await res.json()) as { numClients: number }
    return data.numClients
  } catch {
    return 0
  }
}

export default async function ListenPage() {
  const [{ live, recent }, radioPreview] = await Promise.all([
    fetchChannels(),
    fetchTahtiRadioPreview(),
  ])
  const empty = live.length === 0 && recent.length === 0
  const listenerCountEntries = await Promise.all(
    live.map(async (ch) => [ch.slug, await fetchListenerCount(ch.slug)] as const),
  )
  const listenerCounts = Object.fromEntries(listenerCountEntries)

  return (
    <div className="listen-shell">
      <header className="listen-page-header">
        <h1 className="listen-page-title">Discover</h1>
        <p className="listen-page-sub">Independent artists broadcasting live and on-demand.</p>
      </header>

      <TahtiRadioCard
        hlsUrl={radioPreview.hlsUrl}
        title={radioPreview.title}
        artistName={radioPreview.artistName}
        artworkUrl={radioPreview.artworkUrl}
      />

      {empty ? (
        <div className="public-empty-card">
          <p className="public-empty-card__text">No channels live right now.</p>
          <p className="public-empty-card__hint">
            Check back later, or tune in to <Link href="/radio">Tahti Radio</Link> — archived sets
            on fair rotation.
          </p>
        </div>
      ) : (
        <ListenChannels live={live} recent={recent} listenerCounts={listenerCounts} />
      )}
    </div>
  )
}
