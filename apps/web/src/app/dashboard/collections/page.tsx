// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'
import { cookies } from 'next/headers'
import { Heading, PageShell } from '@tahti/ui'
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

async function fetchCollections(): Promise<CollectionSummary[]> {
  const cookieStore = cookies()
  const session = cookieStore.get('tahti_session')
  const cookie = session ? `tahti_session=${session.value}` : ''

  const res = await fetch(`${apiUrl}/api/me/collections`, {
    headers: { Cookie: cookie },
    cache: 'no-store',
  })
  if (!res.ok) return []
  const data = (await res.json()) as { collections?: CollectionSummary[] }
  return (data.collections ?? []).sort((a, b) => a.publicProfileOrder - b.publicProfileOrder)
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
              + New collection
            </Link>
          </div>
        </header>
        <div className="collections-empty">
          <h2 className="collections-empty__heading">Group your content into collections</h2>
          <p className="collections-empty__body">
            Albums, EPs, DJ-set series, live archives — a collection gives your listeners a curated
            way to explore your work. One track can live in multiple collections; removing it from a
            collection never deletes it.
          </p>
          <Link href="/dashboard/collections/new" className="ui-btn ui-btn--primary">
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
            + New collection
          </Link>
        </div>
      </header>
      <CollectionsGrid collections={collections} />
    </PageShell>
  )
}
