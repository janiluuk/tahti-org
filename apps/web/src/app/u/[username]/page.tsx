// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ProfileHero, ProfilePageLayout } from '@tahti/ui'

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
    tracks: Array<{
      position: number
      title: string
      durationSec: number | null
      archiveItemId?: string | null
      playUrl?: string | null
      channelItemUrl?: string | null
    }>
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
  const isLive = channel?.state === 'LIVE'

  return (
    <ProfilePageLayout
      isLive={isLive}
      hero={
        <ProfileHero
          displayName={artist.displayName}
          username={artist.username}
          bio={artist.bio}
          avatarUrl={artist.avatarUrl}
          isLive={isLive}
          channelHref={links.channel}
          subscribeHref={links.subscribe}
          tipJarUrl={artist.tipJarUrl}
        />
      }
    >
      {collections.length > 0 && (
        <section className="prof-section">
          <div className="prof-sec-label">Collections</div>
          <ul className="prof-list">
            {collections.map((c) => (
              <li key={c.slug} className="prof-list-item">
                <Link href={c.url}>{c.name}</Link>
                <div className="prof-list-meta">
                  {c.type.replace(/_/g, ' ')} · {c.itemCount} item(s)
                  {c.isFeatured && ' · Featured'}
                </div>
                {c.description && (
                  <p className="prof-list-meta" style={{ margin: '0.35rem 0 0' }}>
                    {c.description}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="prof-section">
        <div className="prof-sec-label">Releases</div>
        {releases.length === 0 ? (
          <p className="prof-list-meta">No published releases yet.</p>
        ) : (
          <ul className="prof-list">
            {releases.map((r) => (
              <li id={`release-${r.id}`} key={r.id} className="prof-list-item">
                <div>
                  {r.title}{' '}
                  <span className="prof-list-meta">
                    {r.type} · {new Date(r.releaseDate).toLocaleDateString()}
                  </span>
                </div>
                {r.description && (
                  <p className="prof-list-meta" style={{ margin: '0.5rem 0' }}>
                    {r.description}
                  </p>
                )}
                {r.tracks.length > 0 && (
                  <ol
                    style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem', color: 'var(--text)' }}
                  >
                    {r.tracks.map((t) => (
                      <li
                        key={t.position}
                        id={t.archiveItemId ? `archive-item-${t.archiveItemId}` : undefined}
                        style={{ marginBottom: '0.35rem' }}
                      >
                        {t.title}
                        {t.durationSec != null &&
                          ` (${Math.floor(t.durationSec / 60)}:${String(t.durationSec % 60).padStart(2, '0')})`}
                        {t.playUrl && (
                          <audio
                            controls
                            src={t.playUrl}
                            style={{ display: 'block', width: '100%', marginTop: '0.35rem' }}
                          />
                        )}
                        {t.channelItemUrl && !t.playUrl && (
                          <Link href={t.channelItemUrl} style={{ fontSize: '0.85rem' }}>
                            Listen on channel
                          </Link>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </ProfilePageLayout>
  )
}
