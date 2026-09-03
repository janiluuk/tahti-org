// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { ProfileCover, ProfileHero, ProfilePageLayout } from '@tahti/ui'
import {
  avatarThemeCss,
  logoShowsOnAvatar,
  logoShowsOnCover,
  resolveAvatarTheme,
  type AvatarTheme,
  type LogoPlacement,
} from '@tahti/shared'
import { NewsletterSubscribeForm } from '@/components/newsletter-subscribe-form'
import { FollowButton } from '@/components/follow-button'
import { SendMessageButton } from '@/components/send-message-button'
import { renderBio } from '@/lib/render-bio'
import { SocialLinkIcon, kickUsernameFromUrl } from '@/components/social-link-icon'
import { countryName } from '@/lib/country-options'
import { getSessionUser } from '@/lib/session'
import { logout } from '@/app/auth/actions'
import { ReportButton } from '@/components/report-button'
import { ReleasesGrid } from '@/components/releases-grid'
import { PressKitGallery } from '@/components/press-kit-gallery'
import { FollowersSection } from '@/components/followers-section'
import { resolveChannelUrl } from '@/lib/app-url'
import type { PublicPressKitImage, AddonRenderItem } from '@tahti/shared'
import { AddonFrame } from '@/components/addons/addon-frame'
import StoreSection from './store-section'
import { ProfileTabs } from './_profile-tabs'
import { ProfileCoverVisual } from './_profile-cover-visual'
import { ProfileFeed } from './_profile-feed'
import { TracksTab } from './_tracks-tab'
import { ProfileBackgroundMusic } from './_profile-background-music'
import { humanizeFutureDate } from './profile-upcoming'
import { ChannelGalleryView } from '@/components/gallery'

export const revalidate = 60

/** Rounds to the single largest whole unit — "3 days" / "5 months" / "2 years" —
 * never a combined "X years, Y months" sentence. The precise month/year shows
 * on hover via joinDateTitle instead. */
function relativeSince(date: Date, now: Date): string {
  const days = Math.floor((now.getTime() - date.getTime()) / 86_400_000)
  if (days < 31) return `${days} day${days === 1 ? '' : 's'}`
  const months = Math.floor(days / 30.44)
  if (months < 12) return `${months} month${months === 1 ? '' : 's'}`
  const years = Math.floor(days / 365.25)
  return `${years} year${years === 1 ? '' : 's'}`
}

function formatJoinDateLabel(joinDate: string | null | undefined): string | null {
  if (!joinDate) return null
  const date = new Date(joinDate)
  if (Number.isNaN(date.getTime())) return null
  return `Member since ${relativeSince(date, new Date())}`
}

function formatJoinDateTitle(joinDate: string | null | undefined): string | undefined {
  if (!joinDate) return undefined
  const date = new Date(joinDate)
  if (Number.isNaN(date.getTime())) return undefined
  return `Member since ${date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}`
}

async function fetchProfile(username: string) {
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  // Forward the viewer's session so the API can resolve per-track playback
  // gates (subscriber / purchase-tier access) — this response can now differ
  // by viewer, so it must not go through Next's shared fetch cache. The API's
  // own 20s Redis cache still covers the viewer-agnostic parts.
  const sessionCookie = cookies().get('tahti_session')
  const res = await fetch(`${apiUrl}/api/v1/u/${encodeURIComponent(username)}/profile`, {
    headers: sessionCookie ? { Cookie: `tahti_session=${sessionCookie.value}` } : undefined,
    cache: 'no-store',
  })
  if (!res.ok) return null
  return (await res.json()) as ProfileResponse
}

async function resolveUsernameRedirect(username: string): Promise<string | null> {
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const res = await fetch(`${apiUrl}/api/channels/${encodeURIComponent(username)}/redirect`, {
    next: { revalidate: 60 },
  })
  if (!res.ok) return null
  const data = (await res.json()) as { slug?: string }
  return data.slug && data.slug !== username ? data.slug : null
}

export async function generateMetadata({
  params,
}: {
  params: { username: string }
}): Promise<Metadata> {
  const data = await fetchProfile(params.username)
  if (!data) {
    const nextUsername = await resolveUsernameRedirect(params.username)
    if (nextUsername) {
      return { alternates: { canonical: `/u/${nextUsername}` } }
    }
    return { title: 'Artist not found' }
  }

  const { artist, channel } = data
  const description =
    artist.bio?.slice(0, 160) ??
    `Listen to ${artist.displayName} on Tahti — nonprofit broadcasting for independent artists.`
  const canonicalUrl = resolveChannelUrl(channel?.slug ?? artist.username)

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
    avatarPosterUrl?: string | null
    avatarTheme?: AvatarTheme | null
    logoUrl?: string | null
    logoPlacement?: LogoPlacement | null
    tipJarUrl: string | null
    countryCode?: string | null
    pronouns?: string | null
    tier: string
    socialLinks: Record<string, string> | null
    joinDate?: string | null
    followerCount?: number | null
    followingCount?: number | null
  }
  channel: {
    slug: string
    state: string
    artistKind?: 'SINGLE' | 'COLLECTIVE'
    visualPreset?: string
    galleryMode?: string
    slideshowImages?: string[]
  } | null
  releases: Array<{
    id: string
    title: string
    type: string
    releaseDate: string
    description: string | null
    artworkUrl: string | null
    smartLinkSlug: string
    pinned?: boolean
    pinnedAt?: string | null
    tracks: Array<{
      position: number
      title: string
      durationSec: number | null
      archiveItemId?: string | null
      playUrl?: string | null
      channelItemUrl?: string | null
    }>
  }>
  tracks: Array<{
    id: string
    title: string
    artistName?: string | null
    durationSec: number | null
    bannerUrl: string | null
    playUrl: string | null
    pinned: boolean
    pinnedAt: string | null
    trackOrder: number
    createdAt: string
    channelItemUrl: string | null
    releaseSlug: string | null
    source?: string
    embedProvider?: string | null
    embedUri?: string | null
    peaks?: number[] | null
  }>
  links: {
    channel: string | null
    subscribe: string
    feeds?: { archive: string | null }
    presskit: string
  }
  collections?: Array<{
    slug: string
    name: string
    type: string
    style: string
    description: string | null
    coverUrl?: string | null
    isFeatured?: boolean
    itemCount: number
    url: string
    rssUrl?: string
  }>
  purchaseTiers?: Array<{
    id: string
    name: string
    description: string | null
    priceCents: number
    priceOptional: boolean
  }>
  storePaymentsReady?: boolean
  backgroundMusicUrl?: string | null
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
  linkUrl: string | null
  linkLabel: string | null
  publishAt: string
  createdAt: string
}

interface ArtistEmbedItem {
  id: string
  url: string
  title: string | null
}

interface ArtistMemberItem {
  id: string
  name: string
  role: string
  pictureUrl: string | null
}

interface ArtistUpcomingShow {
  id: string
  startAt: string
  endAt: string
  note: string | null
}

/** Shared row-list rendering for every Collection sub-group inside the
 * Releases tab (DJ Sets / Playlists / Collections) — same markup the flat
 * "Collections" section used before it was split into these sub-groups. */
function CollectionRowList({
  items,
  canEdit = false,
}: {
  items: NonNullable<ProfileResponse['collections']>
  /** Owner or board admin — shows a per-row edit link straight into the studio. */
  canEdit?: boolean
}) {
  return (
    <ul className="prof-list prof-collection-list">
      {items.map((c) => (
        <li key={c.slug}>
          <div className="prof-collection-row">
            <Link href={c.url} className="prof-collection-row__clickarea">
              <div className="prof-collection-cover">
                {c.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.coverUrl} alt="" width={76} height={76} />
                ) : (
                  <span className="prof-collection-cover-ph" aria-hidden />
                )}
              </div>
              <div>
                <div className="prof-collection-title">{c.name}</div>
                <div className="prof-list-meta prof-list-meta--strong">
                  {c.itemCount} item{c.itemCount === 1 ? '' : 's'}
                  {c.isFeatured && ' · Featured'}
                </div>
                {c.description && (
                  <p className="prof-list-meta prof-list-meta--tight">{c.description}</p>
                )}
              </div>
            </Link>
            {canEdit && (
              <Link
                href={`/dashboard/collections/${c.slug}`}
                className="prof-row-edit-btn"
                aria-label={`Edit ${c.name}`}
                title="Edit"
              >
                <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M11.4 1.6a1.5 1.5 0 0 1 2.1 0l.9.9a1.5 1.5 0 0 1 0 2.1l-7.8 7.8-3.4.9.9-3.4 7.3-7.3z"
                  />
                </svg>
              </Link>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}

async function fetchSupportAvailable(username: string): Promise<boolean> {
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  try {
    const res = await fetch(`${apiUrl}/api/v1/u/${encodeURIComponent(username)}/tiers`, {
      next: { revalidate: 60 },
    })
    if (!res.ok) return false
    const data = (await res.json()) as { tiers?: unknown[]; paymentsReady?: boolean }
    return Boolean(data.paymentsReady && Array.isArray(data.tiers) && data.tiers.length > 0)
  } catch {
    return false
  }
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
  if (!slug) {
    return { events: [], posts: [], embeds: [], members: [], upcomingShows: [], addons: [] }
  }
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const [eventsRes, postsRes, embedsRes, membersRes, showRes, addonsRes] = await Promise.all([
    fetch(`${apiUrl}/api/channels/${slug}/events`, { next: { revalidate: 60 } }),
    fetch(`${apiUrl}/api/channels/${slug}/posts`, { next: { revalidate: 60 } }),
    fetch(`${apiUrl}/api/channels/${slug}/embeds`, { next: { revalidate: 60 } }),
    fetch(`${apiUrl}/api/channels/${slug}/members`, { next: { revalidate: 60 } }),
    // Upcoming Tahti Radio guest slots this artist has booked — same "show"
    // concept as the radio page's calendar (RadioSlotBooking), not a venue event.
    fetch(`${apiUrl}/api/v1/radio/show/${slug}`, { next: { revalidate: 60 } }),
    fetch(`${apiUrl}/api/v1/channels/${slug}/addons`, { next: { revalidate: 60 } }),
  ])
  const events: ArtistEventItem[] = eventsRes.ok ? await eventsRes.json() : []
  const posts: ArtistPostItem[] = postsRes.ok ? await postsRes.json() : []
  const embeds: ArtistEmbedItem[] = embedsRes.ok ? await embedsRes.json() : []
  const members: ArtistMemberItem[] = membersRes.ok ? await membersRes.json() : []
  const upcomingShows: ArtistUpcomingShow[] = showRes.ok
    ? ((await showRes.json()) as { upcomingEpisodes: ArtistUpcomingShow[] }).upcomingEpisodes
    : []
  const addons: AddonRenderItem[] = addonsRes.ok
    ? ((await addonsRes.json()) as { widgets: AddonRenderItem[] }).widgets
    : []
  return { events, posts, embeds, members, upcomingShows, addons }
}

export default async function ArtistProfilePage({ params }: { params: { username: string } }) {
  const [data, user, showSupport] = await Promise.all([
    fetchProfile(params.username),
    getSessionUser(),
    fetchSupportAvailable(params.username),
  ])
  if (!data) {
    const nextUsername = await resolveUsernameRedirect(params.username)
    if (nextUsername) redirect(`/u/${nextUsername}`)
    notFound()
  }

  const { artist, channel, releases, tracks, links, collections = [], backgroundMusicUrl } = data
  // Sub-grouped inside the "Releases" tab (see ProfileTabs) rather than
  // separate top-level tabs — keeps the tab bar from growing one tab per
  // content type.
  const djMixCollections = collections.filter((c) => c.style === 'DJ_SET_SERIES')
  const playlistCollections = collections.filter((c) => c.style === 'PLAYLIST')
  const otherCollections = collections.filter(
    (c) => c.style !== 'DJ_SET_SERIES' && c.style !== 'PLAYLIST',
  )
  const isLive = channel?.state === 'LIVE'
  const isOwner = user?.username === artist.username
  const isAdmin = Boolean(user?.isBoard)
  const canEdit = isOwner || isAdmin
  const bioHtml = artist.bio ? await renderBio(artist.bio) : null
  const [{ events, posts, embeds, members, upcomingShows, addons }, pressKitImages] =
    await Promise.all([fetchChannelExtras(channel?.slug), fetchPressKitImages(artist.username)])
  const profileUrl = resolveChannelUrl(artist.username)
  const theme = resolveAvatarTheme(JSON.stringify(artist.avatarTheme ?? null), artist.username)
  // resolveAvatarTheme expects JSON string of stored theme; when artist.avatarTheme
  // is already parsed, prefer it directly to avoid a null→seed round-trip.
  const resolvedTheme = artist.avatarTheme ?? theme
  const themeBackground = avatarThemeCss(resolvedTheme)
  const logoUrl = artist.logoUrl ?? null
  const logoPlacement = artist.logoPlacement ?? null
  // Streaming platforms first (in this fixed order), then whatever else the
  // artist added — same combined order the old "Streaming platforms" +
  // "Find me elsewhere" sections used, just as one compact icon row next to
  // the profile info instead of two labeled sections further down the page.
  const STREAMING_LINK_LABELS: Record<string, string> = {
    youtube: 'YouTube',
    hearthisAt: 'hearthis.at',
    twitch: 'Twitch',
    soundcloud: 'SoundCloud',
    kick: 'Kick',
  }
  const socialLinkEntries: Array<readonly [string, string]> = artist.socialLinks
    ? [
        ...Object.entries(STREAMING_LINK_LABELS)
          .map(([key, label]) => [label, artist.socialLinks![key]] as const)
          .filter(([, url]) => !!url),
        ...Object.entries(artist.socialLinks)
          .filter(([key, url]) => !!url && key !== 'genres' && !(key in STREAMING_LINK_LABELS))
          .map(([key, url]) => [key.charAt(0).toUpperCase() + key.slice(1), url] as const),
      ]
    : []
  const pinnedReleases = releases.filter((r) => r.pinned)
  // Tahti Releases first, then everything else — same items as before, the
  // formal-release section just leads instead of trailing behind DJ Sets/
  // playlists/collections/individual tracks.
  const hasOtherReleaseContent =
    tracks.length > 0 ||
    djMixCollections.length > 0 ||
    playlistCollections.length > 0 ||
    otherCollections.length > 0
  const hasProfileGallery =
    channel?.galleryMode &&
    channel.galleryMode !== 'NONE' &&
    (channel.slideshowImages?.length ?? 0) > 0
  const nextEvent = events[0]
  const nextShow = upcomingShows[0]
  const showIsNext =
    nextShow && (!nextEvent || new Date(nextShow.startAt) < new Date(nextEvent.startAt))
  const nextAppearance = showIsNext
    ? {
        text: `Next live show ${humanizeFutureDate(new Date(nextShow.startAt))} on Tahti Radio`,
        href: '/radio',
        linkLabel: 'Tune in →',
      }
    : nextEvent
      ? {
          text: `Next gig ${humanizeFutureDate(new Date(nextEvent.startAt))} at ${nextEvent.place || nextEvent.location}`,
          href: nextEvent.eventUrl,
          linkLabel: 'Event details ↗',
        }
      : null

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
      {backgroundMusicUrl ? <ProfileBackgroundMusic src={backgroundMusicUrl} /> : null}
      <ProfilePageLayout
        isLive={isLive}
        activeNav="discover"
        logoutAction={logout}
        user={user}
        cover={
          <ProfileCoverVisual preset={channel?.visualPreset}>
            <ProfileCover
              displayName={artist.displayName}
              avatarUrl={artist.avatarUrl}
              avatarPosterUrl={artist.avatarPosterUrl}
              themeBackground={themeBackground}
              logoUrl={logoUrl}
              logoOnCover={logoShowsOnCover(logoPlacement)}
              logoOnAvatar={logoShowsOnAvatar(logoPlacement)}
            />
          </ProfileCoverVisual>
        }
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
            showSupport={showSupport}
            tipJarUrl={artist.tipJarUrl}
            joinDateLabel={formatJoinDateLabel(artist.joinDate)}
            joinDateTitle={formatJoinDateTitle(artist.joinDate)}
            presskitUrl={links.presskit}
            rssUrl={links.feeds?.archive ?? null}
            hideBio
            followSlot={
              user?.username !== artist.username ? (
                <FollowButton artistUsername={artist.username} />
              ) : null
            }
            messageSlot={
              user?.username !== artist.username ? (
                <SendMessageButton artistUsername={artist.username} variant="icon" />
              ) : null
            }
            newsletterSlot={
              <NewsletterSubscribeForm
                artistUsername={artist.username}
                artistDisplayName={artist.displayName}
                isLoggedIn={Boolean(user)}
                variant="icon"
              />
            }
            moreActionSlot={
              channel?.slug ? (
                <ReportButton targetType="CHANNEL" targetId={channel.slug} variant="icon" />
              ) : null
            }
            socialLinksSlot={
              socialLinkEntries.length > 0
                ? socialLinkEntries.map(([label, url]) => (
                    <a
                      key={label}
                      href={url}
                      rel="noopener noreferrer"
                      target={url.startsWith('mailto:') ? undefined : '_blank'}
                      className="prof-header-social-link"
                      title={label}
                      aria-label={label}
                    >
                      <SocialLinkIcon label={label} url={url} />
                    </a>
                  ))
                : undefined
            }
          />
        }
      >
        <div className="prof-follow-row">
          <FollowersSection
            username={artist.username}
            direction="followers"
            count={artist.followerCount ?? null}
          />
          <FollowersSection
            username={artist.username}
            direction="following"
            count={artist.followingCount ?? null}
          />
        </div>
        {/* Default view — always visible, not tab-gated: bio, then feed
            right below it, per the profile redesign. */}
        {artist.bio && (
          <section className="prof-section">
            <div className="prof-sec-label">Biography</div>
            {bioHtml ? (
              <div
                className="prof-bio prof-bio--rich"
                dangerouslySetInnerHTML={{ __html: bioHtml }}
              />
            ) : null}
          </section>
        )}
        <section className="prof-section">
          <div className="prof-sec-label">Feed</div>
          <ProfileFeed posts={posts} releases={releases} />
        </section>
        {nextAppearance && (
          <section className="prof-section">
            <div className="prof-main-upcoming">
              <span>{nextAppearance.text}</span>
              {nextAppearance.href && (
                <Link href={nextAppearance.href}>{nextAppearance.linkLabel}</Link>
              )}
            </div>
          </section>
        )}
        {pressKitImages.length > 0 && (
          <section className="prof-section">
            <div className="prof-sec-label">Press kit</div>
            <PressKitGallery images={pressKitImages} />
          </section>
        )}
        {data.purchaseTiers && data.purchaseTiers.length > 0 && (
          <section className="prof-section">
            <div className="prof-sec-label">Store</div>
            <StoreSection
              username={data.artist.username}
              tiers={data.purchaseTiers}
              paymentsReady={data.storePaymentsReady ?? true}
            />
          </section>
        )}
        {addons.length > 0 && (
          <section className="prof-section">
            <div className="prof-sec-label">Widgets</div>
            {addons.map((w) => (
              <AddonFrame
                key={w.installId}
                sandboxUrl={w.sandboxUrl}
                name={w.name}
                context={w.context}
                config={w.config}
              />
            ))}
          </section>
        )}
        {members.length > 0 && (
          <section className="prof-section">
            <div className="prof-sec-label">
              {channel?.artistKind === 'COLLECTIVE' ? 'Members' : 'Credits'}
            </div>
            <ul className="prof-members-list">
              {members.map((m) => (
                <li key={m.id} className="prof-members-list__item">
                  {m.pictureUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.pictureUrl} alt="" className="prof-members-list__picture" />
                  ) : (
                    <div
                      className="prof-members-list__picture prof-members-list__picture--ph"
                      aria-hidden
                    >
                      {m.name.trim().charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="prof-members-list__name">{m.name}</div>
                  <div className="prof-members-list__role">{m.role}</div>
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
        {/* Tabs sit right below the always-visible intro above. Each content
            type gets its own tab now — previously Releases/DJ Sets/
            Playlists/Collections/Tracks were all stacked inside one
            "Releases" tab, which read as "everything's missing" the moment
            that tab wasn't the active one. Only tabs with actual content
            are included. */}
        <ProfileTabs
          sections={[
            pinnedReleases.length > 0
              ? {
                  id: 'music' as const,
                  label: 'Pinned',
                  description: "The artist's pinned highlights.",
                  content: (
                    <section className="prof-section">
                      <ReleasesGrid releases={pinnedReleases} />
                    </section>
                  ),
                }
              : null,
            releases.length > 0 || !hasOtherReleaseContent
              ? {
                  id: 'releases' as const,
                  label: 'Releases',
                  description: 'Every album, EP, and single the artist has published on Tahti.',
                  content: (
                    <section className="prof-section">
                      <div className="prof-sec-label-row">
                        <div className="prof-sec-label">Tahti Releases</div>
                        <div className="prof-sec-label-row__actions">
                          {releases.length > 0 && (
                            <div className="prof-sec-count">{releases.length} total</div>
                          )}
                          {isOwner && (
                            <Link
                              href="/dashboard/releases"
                              className="prof-sec-add-btn"
                              aria-label="Create a new release"
                              title="Create a new release"
                            >
                              <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
                                <path
                                  fill="currentColor"
                                  d="M10 4a1 1 0 0 1 1 1v4h4a1 1 0 1 1 0 2h-4v4a1 1 0 1 1-2 0v-4H5a1 1 0 1 1 0-2h4V5a1 1 0 0 1 1-1z"
                                />
                              </svg>
                            </Link>
                          )}
                        </div>
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
                  ),
                }
              : null,
            djMixCollections.length > 0
              ? {
                  id: 'djsets' as const,
                  label: 'DJ Sets',
                  description: 'Recorded DJ sets and mix series.',
                  content: (
                    <section className="prof-section">
                      <div className="prof-sec-label-row">
                        <div className="prof-sec-count">{djMixCollections.length} total</div>
                      </div>
                      <CollectionRowList items={djMixCollections} canEdit={canEdit} />
                    </section>
                  ),
                }
              : null,
            playlistCollections.length > 0
              ? {
                  id: 'playlists' as const,
                  label: 'Playlists',
                  description: 'Curated playlists the artist has put together.',
                  content: (
                    <section className="prof-section">
                      <div className="prof-sec-label-row">
                        <div className="prof-sec-count">{playlistCollections.length} total</div>
                      </div>
                      <CollectionRowList items={playlistCollections} canEdit={canEdit} />
                    </section>
                  ),
                }
              : null,
            otherCollections.length > 0
              ? {
                  id: 'collections' as const,
                  label: 'Collections',
                  description: 'Other grouped collections.',
                  content: (
                    <section className="prof-section">
                      <div className="prof-sec-label-row">
                        <div className="prof-sec-count">{otherCollections.length} total</div>
                      </div>
                      <CollectionRowList items={otherCollections} canEdit={canEdit} />
                    </section>
                  ),
                }
              : null,
            tracks.length > 0
              ? {
                  id: 'tracks' as const,
                  label: 'Tracks',
                  description: 'Every individual track the artist has uploaded.',
                  content: (
                    <section className="prof-section">
                      <TracksTab
                        tracks={tracks}
                        isOwner={isOwner}
                        isAdmin={isAdmin}
                        channelSlug={channel?.slug ?? null}
                      />
                    </section>
                  ),
                }
              : null,
            hasProfileGallery
              ? {
                  id: 'gallery' as const,
                  label: 'Gallery',
                  description: 'A visual gallery from the artist.',
                  content: (
                    <section className="prof-section prof-profile-gallery">
                      <ChannelGalleryView
                        mode={
                          channel!.galleryMode as Parameters<typeof ChannelGalleryView>[0]['mode']
                        }
                        images={channel!.slideshowImages ?? []}
                      />
                    </section>
                  ),
                }
              : null,
          ].filter((s): s is NonNullable<typeof s> => s !== null)}
        />
      </ProfilePageLayout>
    </>
  )
}
