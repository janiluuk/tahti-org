// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'

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
    <>
      <p style={{ margin: 0 }}>
        <Link href={`/u/${data.user.username}`}>← {data.user.displayName}</Link>
      </p>
      <header style={{ margin: '1.5rem 0 2rem' }}>
        <h1 style={{ margin: '0 0 0.25rem' }}>{data.name}</h1>
        <p className="brand-muted" style={{ margin: 0 }}>
          {data.type.replace(/_/g, ' ')} · {data.items.length} item(s)
        </p>
        {data.description && (
          <p style={{ marginTop: '1rem', lineHeight: 1.6 }}>{data.description}</p>
        )}
        <p style={{ marginTop: '1rem' }}>
          <a href={rssUrl}>RSS feed ↗</a>
        </p>
      </header>

      {data.items.length === 0 ? (
        <p className="brand-muted">This collection is empty.</p>
      ) : (
        <ol style={{ listStyle: 'none', padding: 0 }}>
          {data.items.map((item) => (
            <li key={item.id} className="channel-archive-item">
              {item.archiveItem && (
                <>
                  <div style={{ fontWeight: 600 }}>{item.archiveItem.title}</div>
                  {item.archiveItem.durationSec != null && (
                    <span className="brand-muted" style={{ fontSize: '0.85rem' }}>
                      {Math.floor(item.archiveItem.durationSec / 60)}:
                      {String(item.archiveItem.durationSec % 60).padStart(2, '0')}
                    </span>
                  )}
                </>
              )}
              {item.release && (
                <div>
                  <Link href={`/r/${item.release.smartLinkSlug}`} style={{ fontWeight: 600 }}>
                    {item.release.title}
                  </Link>
                  <span className="brand-muted" style={{ fontSize: '0.85rem' }}>
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
    </>
  )
}
