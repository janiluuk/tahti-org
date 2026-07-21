// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ProfileCover, ProfileHero, ProfilePageLayout } from '@tahti/ui'
import { NewsletterSubscribeForm } from '@/components/newsletter-subscribe-form'
import { renderBio } from '@/lib/render-bio'
import { SocialLinkIcon, kickUsernameFromUrl } from '@/components/social-link-icon'
import { countryName } from '@/lib/country-options'
import { getSessionUser } from '@/lib/session'
import { ReportButton } from '@/components/report-button'
import { ReleasesGrid } from '@/components/releases-grid'
import { PressKitGallery } from '@/components/press-kit-gallery'
import { resolveChannelUrl } from '@/lib/app-url'
import type { PublicPressKitImage } from '@tahti/shared'

export const revalidate = 60

function formatJoinDateLabel(joinDate: string | null | undefined): string | null {
  if (!joinDate) return null
  const date = new Date(joinDate)
  if (Number.isNaN(date.getTime())) return null
  return `Member since ${date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`
}

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
  const canonicalUrl = resolveChannelUrl(artist.username)

  return {
    title: `${artist.displayName} (@${artist.username})`,
    description,
    alternates: {
      canonical: canonicalUrl,
      ...(data.links.feeds?.archive
        ? { types: { 'application/rss+xml': [{ url: data.links.feeds.archive }] } }
        : {}),
    },
    openGraph: {
      title: artist.displayName,
      description,
      type: 'profile',
      url: canonicalUrl,
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
    joinDate?: string | null
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

interface ArtistEventItem {
  id: string
  title: string
  place: string
  location: string
  eventUrl: string | null
  startAt: string
}

interface ArtistPostItem {
  id: string
  title: string | null
  body: string
  images: string[]
  publishAt: string
  createdAt: string
}

function formatPostDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

interface ArtistEmbedItem {
  id: string
  url: string
  title: string | null
}

async function fetchPressKitImages(username: string): Promise<PublicPressKitImage[]> {
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const res = await fetch(
    `${apiUrl}/api/v1/u/${encodeURIComponent(username)}/press-kit-images.json`,
    {
      next: { revalidate: 60 },
    },
  )
  if (!res.ok) return []
  return (await res.json()) as PublicPressKitImage[]
}

async function fetchChannelExtras(slug: string | undefined) {
  if (!slug) return { events: [], posts: [], embeds: [] }
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const [eventsRes, postsRes, embedsRes] = await Promise.all([
    fetch(`${apiUrl}/api/channels/${slug}/events`, { next: { revalidate: 60 } }),
    fetch(`${apiUrl}/api/channels/${slug}/posts`, { next: { revalidate: 60 } }),
    fetch(`${apiUrl}/api/channels/${slug}/embeds`, { next: { revalidate: 60 } }),
  ])
  const events: ArtistEventItem[] = eventsRes.ok ? await eventsRes.json() : []
  const posts: ArtistPostItem[] = postsRes.ok ? await postsRes.json() : []
  const embeds: ArtistEmbedItem[] = embedsRes.ok ? await embedsRes.json() : []
  return { events, posts, embeds }
}

export default async function ArtistProfilePage({ params }: { params: { username: string } }) {
  const [data, user] = await Promise.all([fetchProfile(params.username), getSessionUser()])
  if (!data) notFound()

  const { artist, channel, releases, links, collections = [] } = data
  const isLive = channel?.state === 'LIVE'
  const bioHtml = artist.bio ? await renderBio(artist.bio) : null
  const [{ events, posts, embeds }, pressKitImages] = await Promise.all([
    fetchChannelExtras(channel?.slug),
    fetchPressKitImages(artist.username),
  ])
  const profileUrl = resolveChannelUrl(artist.username)

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
        user={user}
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
            joinDateLabel={formatJoinDateLabel(artist.joinDate)}
            newsletterSlot={
              <NewsletterSubscribeForm
                artistUsername={artist.username}
                artistDisplayName={artist.displayName}
                isLoggedIn={Boolean(user)}
              />
            }
          />
        }
      >
        {posts.length > 0 && (
          <section className="ch-featured-post">
            <div className="ch-featured-post__label">Latest from {artist.displayName}</div>
            {posts[0]!.title && <div className="ch-posts-list__title">{posts[0]!.title}</div>}
            <div className="ch-posts-list__date">{formatPostDate(posts[0]!.publishAt)}</div>
            <p className="ch-posts-list__body">{posts[0]!.body}</p>
            {posts[0]!.images.length > 0 && (
              <div className="ch-posts-list__images">
                {posts[0]!.images.map((url) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={url} src={url} alt="" className="ch-posts-list__image" />
                ))}
              </div>
            )}
          </section>
        )}

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

        {pressKitImages.length > 0 && (
          <section className="prof-section">
            <div className="prof-sec-label">Gallery</div>
            <PressKitGallery images={pressKitImages} />
          </section>
        )}

        {events.length > 0 && (
          <section className="prof-section">
            <div className="prof-sec-label">Events</div>
            <ul className="ch-events-list">
              {events.map((ev) => (
                <li key={ev.id} className="ch-events-list__item">
                  <div className="ch-events-list__date">
                    {new Date(ev.startAt).toLocaleDateString(undefined, {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </div>
                  <div className="ch-events-list__body">
                    <div className="ch-events-list__title">
                      {ev.title} — {ev.place}, {ev.location}
                    </div>
                    {ev.eventUrl && (
                      <a
                        href={ev.eventUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ch-events-list__link"
                      >
                        Tickets / event link ↗
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {posts.length > 1 && (
          <section className="prof-section">
            <div className="prof-sec-label">Updates</div>
            <ul className="ch-posts-list">
              {posts.slice(1).map((p) => (
                <li key={p.id} className="ch-posts-list__item">
                  {p.title && <div className="ch-posts-list__title">{p.title}</div>}
                  <div className="ch-posts-list__date">{formatPostDate(p.publishAt)}</div>
                  <p className="ch-posts-list__body">{p.body}</p>
                  {p.images.length > 0 && (
                    <div className="ch-posts-list__images">
                      {p.images.map((url) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={url} src={url} alt="" className="ch-posts-list__image" />
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {embeds.length > 0 && (
          <section className="prof-section">
            <div className="prof-sec-label">Listen on SoundCloud</div>
            <div className="ch-embeds-list">
              {embeds.map((e) => (
                <iframe
                  key={e.id}
                  title={e.title ?? 'SoundCloud track'}
                  className="ch-embeds-list__frame"
                  scrolling="no"
                  frameBorder="no"
                  allow="autoplay"
                  src={`https://w.soundcloud.com/player/?url=${encodeURIComponent(e.url)}&color=%23ff5500&auto_play=false&show_comments=false&show_user=true&show_reposts=false&visual=false`}
                />
              ))}
            </div>
          </section>
        )}

        {(() => {
          const kickUrl = artist.socialLinks?.kick
          const kickUsername = kickUrl ? kickUsernameFromUrl(kickUrl) : null
          if (!kickUsername) return null
          return (
            <section className="prof-section">
              <div className="prof-sec-label">Live on Kick</div>
              <div className="ch-embeds-list">
                <iframe
                  title="Kick channel"
                  className="ch-embeds-list__frame ch-embeds-list__frame--kick"
                  frameBorder="no"
                  allowFullScreen
                  src={`https://player.kick.com/${kickUsername}`}
                />
              </div>
            </section>
          )
        })()}

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
            <ReleasesGrid releases={releases} />
          )}
        </section>

        {artist.socialLinks &&
          (() => {
            const STREAMING_LINK_LABELS: Record<string, string> = {
              youtube: 'YouTube',
              hearthisAt: 'hearthis.at',
              twitch: 'Twitch',
              soundcloud: 'SoundCloud',
              kick: 'Kick',
            }
            const streamingLinkEntries = Object.entries(STREAMING_LINK_LABELS)
              .map(([key, label]) => [label, artist.socialLinks![key]] as const)
              .filter(([, url]) => !!url)
            const otherLinkEntries = Object.entries(artist.socialLinks).filter(
              ([key, url]) => !!url && key !== 'genres' && !(key in STREAMING_LINK_LABELS),
            )
            return (
              <>
                {streamingLinkEntries.length > 0 && (
                  <section className="prof-section">
                    <div className="prof-sec-label">Streaming platforms</div>
                    <div className="prof-streaming-links">
                      {streamingLinkEntries.map(([label, url]) => (
                        <a
                          key={label}
                          href={url}
                          rel="noopener noreferrer"
                          target="_blank"
                          className="prof-social-link"
                        >
                          <SocialLinkIcon label={label} url={url} /> {label} ↗
                        </a>
                      ))}
                    </div>
                  </section>
                )}
                {otherLinkEntries.length > 0 && (
                  <section className="prof-section">
                    <div className="prof-sec-label">Find me elsewhere</div>
                    <div className="prof-social-links">
                      {otherLinkEntries.map(([key, url]) => {
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
              </>
            )
          })()}

        {channel?.slug ? (
          <section className="prof-section">
            <ReportButton targetType="CHANNEL" targetId={channel.slug} />
          </section>
        ) : null}
      </ProfilePageLayout>
    </>
  )
}
