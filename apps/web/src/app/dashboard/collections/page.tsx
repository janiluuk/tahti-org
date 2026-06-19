// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'
import { cookies } from 'next/headers'
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
      <div className="collections-page">
        <div className="collections-page__header">
          <h1 className="collections-page__title">Collections</h1>
          <Link href="/dashboard/collections/new" className="studio-btn-primary">
            + New collection
          </Link>
        </div>
        <div className="collections-empty">
          <h2 className="collections-empty__heading">Group your content into collections</h2>
          <p className="collections-empty__body">
            Albums, EPs, DJ-set series, live archives — a collection gives your listeners a curated
            way to explore your work. One track can live in multiple collections; removing it from a
            collection never deletes it.
          </p>
          <Link href="/dashboard/collections/new" className="studio-btn-primary">
            Create your first collection
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="collections-page">
      <div className="collections-page__header">
        <h1 className="collections-page__title">Collections</h1>
        <Link href="/dashboard/collections/new" className="studio-btn-primary">
          + New collection
        </Link>
      </div>
      <CollectionsGrid collections={collections} />
    </div>
  )
}
