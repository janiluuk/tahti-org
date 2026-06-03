// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'

async function fetchProfile(username: string) {
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const res = await fetch(`${apiUrl}/api/v1/u/${encodeURIComponent(username)}/profile`, {
    cache: 'no-store',
  })
  if (!res.ok) return null
  return (await res.json()) as ProfileResponse
}

export async function generateMetadata({
  params,
}: {
  params: { username: string }
}): Promise<Metadata> {
  const data = await fetchProfile(params.username)
  if (!data) return { title: 'Artist not found' }

  const { artist } = data
  const description =
    artist.bio?.slice(0, 160) ??
    `Listen to ${artist.displayName} on Tahti — nonprofit broadcasting for independent artists.`

  return {
    title: `${artist.displayName} (@${artist.username})`,
    description,
    openGraph: {
      title: artist.displayName,
      description,
      type: 'profile',
      ...(artist.avatarUrl ? { images: [{ url: artist.avatarUrl }] } : {}),
    },
  }
}

interface ProfileResponse {
  artist: {
    username: string
    displayName: string
    bio: string | null
    avatarUrl: string | null
    tipJarUrl: string | null
    tier: string
  }
  channel: { slug: string; state: string } | null
  releases: Array<{
    id: string
    title: string
    type: string
    releaseDate: string
    description: string | null
    tracks: Array<{ position: number; title: string; durationSec: number | null }>
  }>
  links: { channel: string | null; subscribe: string }
  collections?: Array<{
    slug: string
    name: string
    type: string
    description: string | null
    isFeatured?: boolean
    itemCount: number
    url: string
  }>
}

export default async function ArtistProfilePage({ params }: { params: { username: string } }) {
  const data = await fetchProfile(params.username)
  if (!data) notFound()

  const { artist, channel, releases, links, collections = [] } = data

  return (
    <div style={{ maxWidth: 720, margin: '3rem auto', padding: '0 1rem', fontFamily: 'system-ui' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ margin: '0 0 0.25rem' }}>{artist.displayName}</h1>
        <p style={{ color: '#666', margin: 0 }}>@{artist.username}</p>
        {channel?.state === 'LIVE' && (
          <p style={{ color: '#16a34a', fontWeight: 600, marginTop: '0.5rem' }}>
            ● Broadcasting now
          </p>
        )}
        {artist.bio && <p style={{ marginTop: '1rem', lineHeight: 1.6 }}>{artist.bio}</p>}
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' }}>
          {links.channel && (
            <Link href={links.channel} style={{ color: '#2563eb' }}>
              Channel →
            </Link>
          )}
          <Link href={links.subscribe} style={{ color: '#2563eb' }}>
            Support →
          </Link>
          {artist.tipJarUrl && (
            <a href={artist.tipJarUrl} style={{ color: '#2563eb' }} rel="noopener noreferrer">
              Tip jar ↗
            </a>
          )}
        </div>
      </header>

      {collections.length > 0 && (
        <section style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '1.25rem' }}>Collections</h2>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {collections.map((c) => (
              <li key={c.slug} style={{ padding: '0.75rem 0', borderBottom: '1px solid #eee' }}>
                <Link href={c.url} style={{ fontWeight: 600, color: '#2563eb' }}>
                  {c.name}
                </Link>
                <span style={{ color: '#888', fontSize: '0.85rem' }}>
                  {' '}
                  · {c.type.replace(/_/g, ' ')} · {c.itemCount} item(s)
                  {c.isFeatured && ' · Featured'}
                </span>
                {c.description && (
                  <p style={{ color: '#555', margin: '0.35rem 0 0', fontSize: '0.9rem' }}>
                    {c.description}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 style={{ fontSize: '1.25rem' }}>Releases</h2>
        {releases.length === 0 ? (
          <p style={{ color: '#999' }}>No published releases yet.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {releases.map((r) => (
              <li
                id={`release-${r.id}`}
                key={r.id}
                style={{ padding: '1rem 0', borderBottom: '1px solid #eee' }}
              >
                <div style={{ fontWeight: 600 }}>
                  {r.title}{' '}
                  <span style={{ color: '#888', fontWeight: 400, fontSize: '0.85rem' }}>
                    {r.type} · {new Date(r.releaseDate).toLocaleDateString()}
                  </span>
                </div>
                {r.description && (
                  <p style={{ color: '#555', margin: '0.5rem 0', fontSize: '0.9rem' }}>
                    {r.description}
                  </p>
                )}
                {r.tracks.length > 0 && (
                  <ol style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem', color: '#444' }}>
                    {r.tracks.map((t) => (
                      <li key={t.position}>
                        {t.title}
                        {t.durationSec != null &&
                          ` (${Math.floor(t.durationSec / 60)}:${String(t.durationSec % 60).padStart(2, '0')})`}
                      </li>
                    ))}
                  </ol>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
