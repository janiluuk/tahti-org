// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ChannelCard, ChannelDirectoryEntry, TahtiSelectsGalleryItem } from '@tahti/shared'
import { TAHTI_RADIO_SLUG } from '@tahti/shared'
import { DiscoverTabs } from './_discover-tabs'
import { TahtiRadioCard } from './_tahti-radio-card'
import { NewToYouSection } from './_new-to-you-section'
import { YourFeedSection } from './_your-feed-section'
import { AddonsSection } from './_addons-section'
import { MobileDisclosure } from './_mobile-disclosure'
import { getSessionUser } from '@/lib/session'

const API_URL = process.env.API_URL ?? 'http://localhost:3001'

async function fetchChannels(): Promise<{
  live: ChannelCard[]
  replaying: ChannelCard[]
  recent: ChannelCard[]
}> {
  try {
    const res = await fetch(`${API_URL}/api/v1/channels`, {
      next: { revalidate: 30, tags: ['channels-live'] },
    })
    if (!res.ok) return { live: [], replaying: [], recent: [] }
    return (await res.json()) as {
      live: ChannelCard[]
      replaying: ChannelCard[]
      recent: ChannelCard[]
    }
  } catch {
    return { live: [], replaying: [], recent: [] }
  }
}

async function fetchDirectory(): Promise<ChannelDirectoryEntry[]> {
  try {
    const res = await fetch(`${API_URL}/api/v1/channels/directory`, { next: { revalidate: 60 } })
    if (!res.ok) return []
    const data = (await res.json()) as { items: ChannelDirectoryEntry[] }
    return data.items
  } catch {
    return []
  }
}

async function fetchSelectsGallery(): Promise<TahtiSelectsGalleryItem[]> {
  try {
    const res = await fetch(`${API_URL}/api/v1/tahti-selects/gallery`, {
      next: { revalidate: 60 },
    })
    if (!res.ok) return []
    const data = (await res.json()) as { items: TahtiSelectsGalleryItem[] }
    return data.items
  } catch {
    return []
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
    // The presence API itself is already Redis-cached for 5s (see
    // apps/api/src/routes/chat/presence.ts) — matching that here (instead of
    // no-store) lets Next.js ISR-cache this whole page. A single no-store
    // fetch anywhere on the page forces the entire route into fully-dynamic
    // rendering, which was defeating the revalidate: 30/60 on every *other*
    // fetch here too and making every visitor pay for a fresh server render
    // (including one parallel presence round-trip per live channel).
    const res = await fetch(`${API_URL}/api/channels/${slug}/presence`, {
      next: { revalidate: 10 },
    })
    if (!res.ok) return 0
    const data = (await res.json()) as { numClients: number }
    return data.numClients
  } catch {
    return 0
  }
}

async function fetchRanks(archiveItemIds: string[]): Promise<Record<string, number>> {
  if (archiveItemIds.length === 0) return {}
  try {
    const res = await fetch(`${API_URL}/api/top-lists/ranks?ids=${archiveItemIds.join(',')}`, {
      next: { revalidate: 60 },
    })
    if (!res.ok) return {}
    const data = (await res.json()) as { ranks: Record<string, number> }
    return data.ranks
  } catch {
    return {}
  }
}

export default async function ListenPage() {
  const [{ live, replaying }, radioPreview, directory, gallery, user] = await Promise.all([
    fetchChannels(),
    fetchTahtiRadioPreview(),
    fetchDirectory(),
    fetchSelectsGallery(),
    getSessionUser(),
  ])
  const listenerCountEntries = await Promise.all(
    live.map(async (ch) => [ch.slug, await fetchListenerCount(ch.slug)] as const),
  )
  const listenerCounts = Object.fromEntries(listenerCountEntries)
  const galleryRanks = await fetchRanks(gallery.map((g) => g.archiveItemId))

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

      <MobileDisclosure title="For you">
        <YourFeedSection viewerUsername={user?.username ?? null} />
        <NewToYouSection />
        <AddonsSection />
      </MobileDisclosure>

      <DiscoverTabs
        live={live}
        replaying={replaying}
        listenerCounts={listenerCounts}
        directory={directory}
        gallery={gallery}
        galleryRanks={galleryRanks}
      />
    </div>
  )
}
