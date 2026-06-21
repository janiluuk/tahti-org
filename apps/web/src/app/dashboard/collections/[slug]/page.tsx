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

async function fetchCollection(slug: string): Promise<CollectionDetail | null> {
  const cookieStore = cookies()
  const session = cookieStore.get('tahti_session')
  const cookie = session ? `tahti_session=${session.value}` : ''

  const res = await fetch(`${apiUrl}/api/me/collections/${encodeURIComponent(slug)}`, {
    headers: { Cookie: cookie },
    cache: 'no-store',
  })
  if (!res.ok) return null
  return res.json()
}

export default async function CollectionDetailPage({ params }: { params: { slug: string } }) {
  const collection = await fetchCollection(params.slug)
  if (!collection) notFound()

  return <CollectionEditor collection={collection} />
}
