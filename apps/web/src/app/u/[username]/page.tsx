// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ProfileCover, ProfileHero, ProfilePageLayout } from '@tahti/ui'
import { NewsletterSubscribeForm } from '@/components/newsletter-subscribe-form'
import { renderBio } from '@/lib/render-bio'
import { SocialLinkIcon } from '@/components/social-link-icon'
import { countryName } from '@/lib/country-options'

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
    alternates: data.links.feeds?.archive
      ? { types: { 'application/rss+xml': [{ url: data.links.feeds.archive }] } }
      : undefined,
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
    countryCode?: string | null
    pronouns?: string | null
    tier: string
    socialLinks: Record<string, string> | null
  }
  channel: { slug: string; state: string } | null
  releases: Array<{
    id: string
    title: string
    type: string
    releaseDate: string
    description: string | null
    artworkUrl: string | null
    smartLinkSlug: string
    tracks: Array<{
      position: number
      title: string
      durationSec: number | null
      archiveItemId?: string | null
      playUrl?: string | null
      channelItemUrl?: string | null
    }>
  }>
  links: { channel: string | null; subscribe: string; feeds?: { archive: string | null } }
  collections?: Array<{
    slug: string
    name: string
    type: string
    description: string | null
    coverUrl?: string | null
    isFeatured?: boolean
    itemCount: number
    url: string
    rssUrl?: string
  }>
}

export default async function ArtistProfilePage({ params }: { params: { username: string } }) {
  const data = await fetchProfile(params.username)
  if (!data) notFound()

  const { artist, channel, releases, links, collections = [] } = data
  const isLive = channel?.state === 'LIVE'
  const bioHtml = artist.bio ? await renderBio(artist.bio) : null
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
        cover={<ProfileCover displayName={artist.displayName} avatarUrl={artist.avatarUrl} />}
        hero={
          <ProfileHero
            displayName={artist.displayName}
            username={artist.username}
            bio={artist.bio}
            bioHtml={bioHtml}
            avatarUrl={artist.avatarUrl}
            countryCode={artist.countryCode}
            countryLabel={countryName(artist.countryCode)}
            pronouns={artist.pronouns}
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
          isLoggedIn={false}
        />

        {links.feeds?.archive && (
          <section className="prof-section">
            <div className="prof-sec-label">Podcasts &amp; feeds</div>
            <p className="prof-rss-row">
              <a href={links.feeds.archive} rel="alternate">
                Archive RSS ↗
              </a>
            </p>
            <p className="prof-list-meta prof-list-meta--tight">
              Subscribe in Apple Podcasts, Overcast, or any RSS reader
            </p>
          </section>
        )}

        {collections.length > 0 && (
          <section className="prof-section">
            <div className="prof-sec-label">Collections</div>
            <ul className="prof-list prof-collection-list">
              {collections.map((c) => (
                <li key={c.slug} className="prof-collection-row">
                  <div className="prof-collection-cover">
                    {c.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.coverUrl} alt="" width={56} height={56} />
                    ) : (
                      <span className="prof-collection-cover-ph" aria-hidden />
                    )}
                  </div>
                  <div>
                    <Link href={c.url}>{c.name}</Link>
                    <div className="prof-list-meta">
                      {c.type.replace(/_/g, ' ')} · {c.itemCount} item(s)
                      {c.isFeatured && ' · Featured'}
                    </div>
                    {c.rssUrl && (
                      <p className="prof-rss-row">
                        <a href={c.rssUrl} rel="alternate">
                          RSS ↗
                        </a>
                      </p>
                    )}
                    {c.description && (
                      <p className="prof-list-meta prof-list-meta--tight">{c.description}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="prof-section">
          <div className="prof-sec-label-row">
            <div className="prof-sec-label">Releases</div>
            {releases.length > 0 && <div className="prof-sec-count">{releases.length} total</div>}
          </div>
          {releases.length === 0 ? (
            <div className="public-empty-card">
              <p className="public-empty-card__text">No published releases yet.</p>
              <p className="public-empty-card__hint">
                {isLive && links.channel ? (
                  <Link href={links.channel}>Tune in live</Link>
                ) : (
                  'New releases appear here when the artist publishes.'
                )}
              </p>
            </div>
          ) : (
            <ul className="prof-release-grid">
              {releases.map((r) => {
                const year = new Date(r.releaseDate).getFullYear()
                return (
                  <li id={`release-${r.id}`} key={r.id} className="prof-release-card">
                    <Link href={`/r/${r.smartLinkSlug}`} className="prof-release-card-art">
                      {r.artworkUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.artworkUrl} alt={r.title} />
                      ) : null}
                    </Link>
                    <Link href={`/r/${r.smartLinkSlug}`} className="prof-release-card-title">
                      {r.title}
                    </Link>
                    <div className="prof-release-card-meta">
                      {r.type} · {year}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {artist.socialLinks && Object.keys(artist.socialLinks).length > 0 && (
          <section className="prof-section">
            <div className="prof-sec-label">Find me elsewhere</div>
            <div className="prof-social-links">
              {Object.entries(artist.socialLinks).map(([key, url]) => {
                if (!url || key === 'genres') return null
                const label = key.charAt(0).toUpperCase() + key.slice(1)
                const isEmail = url.startsWith('mailto:')
                return (
                  <a
                    key={key}
                    href={url}
                    rel="noopener noreferrer"
                    target={isEmail ? undefined : '_blank'}
                    className="prof-social-link"
                  >
                    <SocialLinkIcon label={label} url={url} /> {label} ↗
                  </a>
                )
              })}
            </div>
          </section>
        )}
      </ProfilePageLayout>
    </>
  )
}
