// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import type { ArchiveItemSource, ArchiveQualityBadge } from '@tahti/shared'
import { CollectionEditor } from './_collection-editor'

const apiUrl = process.env.API_URL ?? 'http://localhost:3001'

interface CollectionItem {
  id: string
  position: number
  archiveItem: {
    id: string
    title: string
    durationSec: number | null
    mp3Key: string | null
    bannerUrl: string | null
    createdAt: string
    source: ArchiveItemSource
    qualityBadge: ArchiveQualityBadge
  } | null
  release: {
    id: string
    title: string
    type: string
    smartLinkSlug: string
    artworkUrl: string | null
  } | null
}

interface CollectionDetail {
  id: string
  slug: string
  name: string
  description: string | null
  type: string
  style: string
  trackSortMode: string
  visibility: string
  coverMode: string
  coverUrl: string | null
  isPublic: boolean
  isFeatured: boolean
  publicProfileOrder: number
  scheduledPublishAt: string | null
  smartLinksJson: unknown
  galleryMode: string
  textLayerMode: string
  items: CollectionItem[]
}

function sessionCookieHeader(): string {
  const cookieStore = cookies()
  const session = cookieStore.get('tahti_session')
  return session ? `tahti_session=${session.value}` : ''
}

async function fetchCollection(slug: string): Promise<CollectionDetail | null> {
  const res = await fetch(`${apiUrl}/api/me/collections/${encodeURIComponent(slug)}`, {
    headers: { Cookie: sessionCookieHeader() },
    cache: 'no-store',
  })
  if (!res.ok) return null
  return res.json()
}

export interface LibraryArchiveItem {
  id: string
  title: string
  status: string
}

export interface LibraryRelease {
  id: string
  title: string
  state: string
}

async function fetchMyArchiveItems(): Promise<LibraryArchiveItem[]> {
  const res = await fetch(`${apiUrl}/api/me/archive`, {
    headers: { Cookie: sessionCookieHeader() },
    cache: 'no-store',
  })
  if (!res.ok) return []
  const items = (await res.json()) as Array<{ id: string; title: string; status: string }>
  return items.map((i) => ({ id: i.id, title: i.title, status: i.status }))
}

async function fetchMyReleases(): Promise<LibraryRelease[]> {
  const res = await fetch(`${apiUrl}/api/me/releases`, {
    headers: { Cookie: sessionCookieHeader() },
    cache: 'no-store',
  })
  if (!res.ok) return []
  const data = (await res.json()) as { releases: Array<{ id: string; title: string; state: string }> }
  return data.releases.map((r) => ({ id: r.id, title: r.title, state: r.state }))
}

export default async function CollectionDetailPage({ params }: { params: { slug: string } }) {
  const [collection, myArchiveItems, myReleases] = await Promise.all([
    fetchCollection(params.slug),
    fetchMyArchiveItems(),
    fetchMyReleases(),
  ])
  if (!collection) notFound()

  return (
    <CollectionEditor
      collection={collection}
      myArchiveItems={myArchiveItems}
      myReleases={myReleases}
    />
  )
}
