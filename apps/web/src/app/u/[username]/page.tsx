// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ProfileHero, ProfilePageLayout } from '@tahti/ui'
import { NewsletterSubscribeForm } from '@/components/newsletter-subscribe-form'

export const revalidate = 60

async function fetchProfile(username: string) {
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const res = await fetch(`${apiUrl}/api/v1/u/${encodeURIComponent(username)}/profile`, {
    next: { revalidate: 60 },
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

function formatDuration(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}

export default async function ArtistProfilePage({ params }: { params: { username: string } }) {
  const data = await fetchProfile(params.username)
  if (!data) notFound()

  const { artist, channel, releases, links, collections = [] } = data
  const isLive = channel?.state === 'LIVE'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? 'https://app.tahti.live'
  const profileUrl = `${appUrl.replace(/\/$/, '')}/u/${artist.username}`

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'MusicGroup',
    name: artist.displayName,
    url: profileUrl,
    ...(artist.bio ? { description: artist.bio.slice(0, 500) } : {}),
    ...(artist.avatarUrl ? { image: artist.avatarUrl } : {}),
    album: releases.map((r) => ({
      '@type': 'MusicAlbum',
      name: r.title,
      datePublished: r.releaseDate.slice(0, 10),
    })),
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
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
        <NewsletterSubscribeForm
          artistUsername={artist.username}
          artistDisplayName={artist.displayName}
        />

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
                    <p className="prof-list-meta prof-list-meta--tight">{c.description}</p>
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
                    <p className="prof-list-meta prof-list-meta--spaced">{r.description}</p>
                  )}
                  {r.tracks.length > 0 && (
                    <ol className="prof-track-list">
                      {r.tracks.map((t) => (
                        <li
                          key={t.position}
                          id={t.archiveItemId ? `archive-item-${t.archiveItemId}` : undefined}
                        >
                          {t.title}
                          {t.durationSec != null && ` (${formatDuration(t.durationSec)})`}
                          {t.playUrl && (
                            <audio controls src={t.playUrl} className="prof-track-audio" />
                          )}
                          {t.channelItemUrl && !t.playUrl && (
                            <Link href={t.channelItemUrl} className="prof-channel-link">
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
    </>
  )
}
