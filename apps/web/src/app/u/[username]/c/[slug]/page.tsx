// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ProfilePageLayout, SafePlainText } from '@tahti/ui'

async function fetchCollection(slug: string) {
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const res = await fetch(`${apiUrl}/api/v1/collections/${encodeURIComponent(slug)}`, {
    cache: 'no-store',
  })
  if (!res.ok) return null
  return (await res.json()) as CollectionResponse
}

interface CollectionResponse {
  name: string
  description: string | null
  type: string
  user: { username: string; displayName: string }
  items: Array<{
    id: string
    position: number
    archiveItem: {
      id: string
      title: string
      durationSec: number | null
      bannerUrl: string | null
    } | null
    release: {
      id: string
      title: string
      type: string
      smartLinkSlug: string
      releaseDate: string
    } | null
  }>
  links?: { page?: string; rss?: string }
}

function formatDuration(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}

export async function generateMetadata({
  params,
}: {
  params: { username: string; slug: string }
}): Promise<Metadata> {
  const data = await fetchCollection(params.slug)
  if (!data || data.user.username !== params.username) return { title: 'Collection not found' }
  return {
    title: `${data.name} — ${data.user.displayName}`,
    description: data.description ?? `${data.name} on Tahti`,
  }
}

export default async function CollectionPage({
  params,
}: {
  params: { username: string; slug: string }
}) {
  const data = await fetchCollection(params.slug)
  if (!data || data.user.username !== params.username) notFound()

  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const rssUrl = data.links?.rss ?? `${apiUrl}/api/v1/collections/${params.slug}/rss.xml`

  return (
    <ProfilePageLayout
      hero={
        <>
          <Link href={`/u/${data.user.username}`} className="prof-back-link">
            ← {data.user.displayName}
          </Link>
          <h1 className="prof-page-title">{data.name}</h1>
          <p className="prof-list-meta">
            {data.type.replace(/_/g, ' ')} · {data.items.length} item(s)
          </p>
          {data.description && (
            <SafePlainText text={data.description} className="prof-list-meta--spaced" />
          )}
          <p className="prof-rss-row">
            <a href={rssUrl}>RSS feed ↗</a>
          </p>
        </>
      }
    >
      <section className="prof-section">
        {data.items.length === 0 ? (
          <p className="prof-list-meta">This collection is empty.</p>
        ) : (
          <ol className="prof-list">
            {data.items.map((item) => (
              <li key={item.id} className="prof-list-item">
                {item.archiveItem && (
                  <>
                    <div className="prof-collection-title">{item.archiveItem.title}</div>
                    {item.archiveItem.durationSec != null && (
                      <span className="prof-list-meta">
                        {formatDuration(item.archiveItem.durationSec)}
                      </span>
                    )}
                  </>
                )}
                {item.release && (
                  <div>
                    <Link href={`/r/${item.release.smartLinkSlug}`}>{item.release.title}</Link>
                    <span className="prof-list-meta">
                      {' '}
                      · {item.release.type} ·{' '}
                      {new Date(item.release.releaseDate).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
    </ProfilePageLayout>
  )
}
