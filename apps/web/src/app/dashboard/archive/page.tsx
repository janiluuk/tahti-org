// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import NextLink from 'next/link'
import { Heading, PageShell, Panel, SidebarNavIconSvg } from '@tahti/ui'
import { getDashboardUser } from '@/lib/dashboard-session'
import { StudioHeaderActions } from '../_studio-header-actions'
import { fetchMixcloudStatus } from '../mixcloud-actions'
import { MusicBrowser, type AlbumSummary, type CollectionSummary } from './_music-browser'

interface ArchiveItem {
  id: string
  title: string
  durationSec: number | null
  audioUrl: string | null
  createdAt: string
}

interface CollectionApiItem {
  archiveItem?: { bannerUrl: string | null } | null
}

interface CollectionApiRow {
  slug: string
  name: string
  style: string
  visibility: string
  coverMode: string
  coverUrl: string | null
  publicProfileOrder: number
  items?: CollectionApiItem[]
  _count?: { items: number }
}

async function apiFetch<T>(apiUrl: string, cookie: string, path: string): Promise<T | null> {
  try {
    const res = await fetch(`${apiUrl}${path}`, {
      headers: { Cookie: cookie },
      cache: 'no-store',
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

export default async function ArchivePage() {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get('tahti_session')
  if (!sessionCookie) redirect('/login')

  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const cookie = `tahti_session=${sessionCookie.value}`

  const user = await getDashboardUser()
  if (!user) redirect('/login')

  const slug = user.channel?.slug

  const [archiveItemsForEdit, archiveItems, releasesRes, collectionsRes, mixcloudStatus] =
    await Promise.all([
      slug
        ? apiFetch<Array<Record<string, unknown> & { id: string; title: string; status: string }>>(
            apiUrl,
            cookie,
            '/api/me/archive',
          )
        : Promise.resolve([]),
      slug
        ? apiFetch<ArchiveItem[]>(apiUrl, cookie, `/api/channels/${slug}/items`)
        : Promise.resolve([]),
      apiFetch<{ releases: AlbumSummary[] }>(apiUrl, cookie, '/api/me/releases'),
      apiFetch<CollectionApiRow[]>(apiUrl, cookie, '/api/me/collections?expand=items'),
      fetchMixcloudStatus(),
    ])

  const items = archiveItemsForEdit ?? []
  const playable = archiveItems ?? []
  const albums = releasesRes?.releases ?? []
  const collections: CollectionSummary[] = (collectionsRes ?? [])
    .map((c) => ({
      slug: c.slug,
      name: c.name,
      style: c.style,
      visibility: c.visibility,
      coverMode: c.coverMode,
      coverUrl: c.coverUrl,
      publicProfileOrder: c.publicProfileOrder,
      itemCount: c.items?.length ?? c._count?.items ?? 0,
      itemCovers: (c.items ?? [])
        .map((i) => i.archiveItem?.bannerUrl)
        .filter((url): url is string => Boolean(url))
        .slice(0, 4),
    }))
    .sort((a, b) => a.publicProfileOrder - b.publicProfileOrder)

  return (
    <PageShell size="lg">
      <div className="studio-page-header">
        <div>
          <Heading level={1}>Music</Heading>
        </div>
        <div className="studio-page-header__actions">
          <StudioHeaderActions
            hasChannel={Boolean(user.channel)}
            isLive={user.channel?.state === 'LIVE'}
            channelSlug={user.channel?.slug}
            showBack
          />
        </div>
      </div>

      {items.length === 0 && albums.length === 0 && collections.length === 0 ? (
        <Panel
          title="Recordings"
          headerTight
          description="Find a recording and do something with it — polish and publish, or re-edit."
        >
          <div className="studio-empty-card studio-mt-sm studio-mb-0">
            <p className="studio-empty-card__text">No music yet.</p>
            <p className="studio-empty-card__hint">
              Upload a set or go live — it will appear here once ready.
            </p>
            <NextLink
              href="/dashboard/upload"
              className="ui-btn ui-btn--sm ui-btn--primary studio-mt-sm"
            >
              <SidebarNavIconSvg name="upload" />
              Upload a set
            </NextLink>
          </div>
        </Panel>
      ) : (
        <MusicBrowser
          items={items}
          playable={playable}
          albums={albums}
          collections={collections}
          mixcloudConnected={mixcloudStatus.connected}
          mixcloudConfigured={mixcloudStatus.configured}
          apiUrl={apiUrl}
          channelSlug={slug ?? null}
        />
      )}
    </PageShell>
  )
}
