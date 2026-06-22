// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'
import { cookies } from 'next/headers'
import { Heading, PageShell, SidebarNavIconSvg } from '@tahti/ui'
import { CollectionsGrid } from './_collections-grid'

const apiUrl = process.env.API_URL ?? 'http://localhost:3001'

interface CollectionSummary {
  slug: string
  name: string
  style: string
  visibility: string
  coverMode: string
  coverUrl: string | null
  publicProfileOrder: number
  itemCount: number
  itemCovers: string[]
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

async function fetchCollections(): Promise<CollectionSummary[]> {
  const cookieStore = cookies()
  const session = cookieStore.get('tahti_session')
  const cookie = session ? `tahti_session=${session.value}` : ''

  const res = await fetch(`${apiUrl}/api/me/collections?expand=items`, {
    headers: { Cookie: cookie },
    cache: 'no-store',
  })
  if (!res.ok) return []
  const data = (await res.json()) as CollectionApiRow[]
  return data
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
}

export default async function CollectionsPage() {
  const collections = await fetchCollections()

  if (collections.length === 0) {
    return (
      <PageShell size="lg" className="collections-page">
        <header className="studio-page-header collections-page__header">
          <div>
            <Heading level={1}>Collections</Heading>
          </div>
          <div className="studio-page-header__actions">
            <Link href="/dashboard/collections/new" className="ui-btn ui-btn--primary ui-btn--sm">
              <SidebarNavIconSvg name="collections" />
              New collection
            </Link>
          </div>
        </header>
        <div className="studio-empty-card collections-empty">
          <h2 className="studio-empty-card__text">Group your content into collections</h2>
          <p className="studio-empty-card__hint">
            Albums, EPs, DJ-set series, live archives — a collection gives your listeners a curated
            way to explore your work. One track can live in multiple collections; removing it from a
            collection never deletes it.
          </p>
          <Link href="/dashboard/collections/new" className="ui-btn ui-btn--primary studio-mt-md">
            <SidebarNavIconSvg name="collections" />
            Create your first collection
          </Link>
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell size="lg" className="collections-page">
      <header className="studio-page-header collections-page__header">
        <div>
          <Heading level={1}>Collections</Heading>
        </div>
        <div className="studio-page-header__actions">
          <Link href="/dashboard/collections/new" className="ui-btn ui-btn--primary ui-btn--sm">
            <SidebarNavIconSvg name="collections" />
            New collection
          </Link>
        </div>
      </header>
      <CollectionsGrid collections={collections} />
    </PageShell>
  )
}
