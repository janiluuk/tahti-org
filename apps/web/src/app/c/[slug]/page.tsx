// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import {
  TAHTI_RADIO_SLUG,
  TAHTI_SELECTS_SLUG,
  parseVisualSettingsMap,
  resolveVisualPresetSettings,
  type VisualPreset,
} from '@tahti/shared'
import { HelpTourButton, getPublicTourSteps } from '@tahti/ui'
import { GalleryPhotosButton } from './_gallery-photos-button'
import ChatPanel from './chat-panel'
import FanChatPanel from './fan-chat-panel'
import { LivePlayerSection } from './live-player-section'
import { LiveTracklistPanel } from '@/components/live-tracklist-panel'
import { ChannelGalleryView } from './channel-gallery'
import { ArchiveItemGallery } from './archive-item-gallery'
import { ChannelTextLayerView } from '@/components/text-layer'
import { ChannelPageVisualizer } from './_channel-page-visualizer'
import { ChannelColorScheme } from '@/components/visuals/channel-color-scheme'
import { ChannelSlideshow } from '@/components/visuals/channel-slideshow'
import { TracklistView } from '@/components/tracklist/tracklist-view'
import { ArchiveItemPlayback } from '@/components/archive-item-playback'
import { BroadcastCountdown } from '@/components/broadcast-countdown'
import { ArchiveVideoBackdrop, resolveArchiveBackground } from './archive-item-backdrop'
import type { PlayerTrack } from '@/contexts/player-context'
import type {
  ChannelGalleryMode,
  ChannelTextLayerAlignment,
  ChannelTextLayerMode,
  TracklistEntry,
} from '@tahti/shared'
import {
  AvatarTile,
  Heading,
  Row,
  Text,
  ChannelPageShell,
  SafePlainText,
  RankBadge,
} from '@tahti/ui'
import { channelArchiveRssUrl } from '@/lib/rss-feeds'
import { resolveChannelUrl } from '@/lib/app-url'
import { getSessionUser } from '@/lib/session'
import { logout } from '@/app/auth/actions'
import { renderBio } from '@/lib/render-bio'
import { flagEmoji as countryCodeToFlag } from '@/lib/flag-emoji'
import { countryName } from '@/lib/country-options'
import { SocialLinkIcon, kickUsernameFromUrl } from '@/components/social-link-icon'
import { ReportButton } from '@/components/report-button'
import { TrackCommentsToggle } from '@/components/track-comments-toggle'
import { FollowButton } from '@/components/follow-button'
import { ReleasesGrid, type ReleaseGridItem } from '@/components/releases-grid'
import { ChannelTabs } from './_channel-tabs'
import { PublicChannelTabs } from './_public-tabs'
import { ManagePanel, type ManageStats } from './_manage-panel'
import { cookies } from 'next/headers'

function formatJoinDateLabel(joinDate: string | null | undefined): string | null {
  if (!joinDate) return null
  const date = new Date(joinDate)
  if (Number.isNaN(date.getTime())) return null
  return `Member since ${date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`
}

interface ChannelResponse {
  slug: string
  state: string
  hlsUrl: string | null
  nextBroadcastAt: string | null
  nextBroadcastNote: string | null
  galleryMode: ChannelGalleryMode
  slideshowImages: string[]
  textLayerMode: ChannelTextLayerMode
  textLayerText: string
  textLayerAlign: ChannelTextLayerAlignment
  videoBackgroundUrl?: string | null
  colorSchemeJson?: string | null
  visualPreset?: string
  visualSettingsJson?: string | null
  slideshowPreset?: string
  slideshowIntervalSeconds?: number
  slideshowTransitionMs?: number
  slideshowAutoplay?: boolean
  user: {
    username: string
    displayName: string
    bio: string | null
    avatarUrl: string | null
    countryCode?: string | null
    pronouns?: string | null
    socialLinks?: Record<string, string> | null
    tier: string
    joinDate?: string | null
    chatEnabled?: boolean
  }
  nowPlaying: {
    title: string
    artistName: string
    artistUsername: string | null
    artworkUrl: string | null
  } | null
  nowPlayingNext: { title: string; artistName: string; artistUsername: string } | null
}

interface ArchiveItem {
  id: string
  title: string
  artistName?: string | null
  credits?: Array<{ role: string; name: string; artistUsername?: string }> | null
  description: string | null
  commentary: string | null
  durationSec: number | null
  audioUrl: string | null
  peaks?: number[] | null
  createdAt: string
  genre?: string | null
  genreCustom?: string | null
  tracklist?: TracklistEntry[] | null
  visualPreset?: string | null
  repostToDownload?: boolean
  followToDownload?: boolean
  bannerUrl?: string | null
  backgroundUrl?: string | null
  slideshowUrls?: string[]
  galleryMode?: ChannelGalleryMode
  galleryAudioReactive?: boolean
  commentCount?: number
  downloadCount?: number
  accentColor?: string | null
}

interface Announcement {
  id: string
  body: string
  createdAt: string
}

export default async function ChannelPage({ params }: { params: { slug: string } }) {
  const { slug } = params
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'

  const channelRes = await fetch(`${apiUrl}/api/channels/${slug}`, { cache: 'no-store' })

  if (channelRes.status === 404) {
    // The artist may have renamed away from this slug — routes/me/channel-slug.ts
    // keeps a 30-day redirect to their current address before it's freed up.
    const redirectRes = await fetch(`${apiUrl}/api/channels/${slug}/redirect`, {
      cache: 'no-store',
    })
    if (redirectRes.ok) {
      const { slug: newSlug } = (await redirectRes.json()) as { slug: string }
      redirect(resolveChannelUrl(newSlug))
    }
    notFound()
  }

  if (!channelRes.ok) {
    throw new Error('Failed to load channel')
  }

  const channel = (await channelRes.json()) as ChannelResponse

  const [itemsRes, announcementsRes, eventsRes, postsRes, embedsRes, profileRes, tiersRes, user] =
    await Promise.all([
      fetch(`${apiUrl}/api/channels/${slug}/items`, { cache: 'no-store' }),
      fetch(`${apiUrl}/api/chat/${slug}/announcements`, { cache: 'no-store' }),
      fetch(`${apiUrl}/api/channels/${slug}/events`, { cache: 'no-store' }),
      fetch(`${apiUrl}/api/channels/${slug}/posts`, { cache: 'no-store' }),
      fetch(`${apiUrl}/api/channels/${slug}/embeds`, { cache: 'no-store' }),
      fetch(`${apiUrl}/api/v1/u/${encodeURIComponent(channel.user.username)}/profile`, {
        cache: 'no-store',
      }),
      fetch(`${apiUrl}/api/v1/u/${encodeURIComponent(channel.user.username)}/tiers`, {
        next: { revalidate: 60 },
      }),
      getSessionUser(),
    ])
  const releases: ReleaseGridItem[] = profileRes.ok
    ? ((await profileRes.json()) as { releases: ReleaseGridItem[] }).releases
    : []
  const showSupport = tiersRes.ok
    ? await tiersRes
        .json()
        .then((data: { tiers?: unknown[]; paymentsReady?: boolean }) =>
          Boolean(data.paymentsReady && Array.isArray(data.tiers) && data.tiers.length > 0),
        )
        .catch(() => false)
    : false

  const items: ArchiveItem[] = itemsRes.ok ? ((await itemsRes.json()) as ArchiveItem[]) : []
  const ranks: Record<string, number> =
    items.length > 0
      ? await fetch(`${apiUrl}/api/top-lists/ranks?ids=${items.map((i) => i.id).join(',')}`, {
          next: { revalidate: 60 },
        })
          .then((res) => (res.ok ? res.json() : { ranks: {} }))
          .then((data: { ranks: Record<string, number> }) => data.ranks)
          .catch(() => ({}))
      : {}
  // Shared play queue for every playable archive item, in list order — lets
  // playback auto-advance to the next track on 'ended' instead of just stopping.
  const archiveQueue: PlayerTrack[] = items
    .filter((i) => i.audioUrl)
    .map((i) => ({
      id: i.id,
      kind: 'archive',
      url: i.audioUrl!,
      title: i.title,
      subtitle: i.artistName?.trim() || `@${channel.user.username}`,
      href: `${resolveChannelUrl(slug)}#archive-item-${i.id}`,
      artworkUrl: i.bannerUrl,
    }))
  const announcements: Announcement[] = announcementsRes.ok
    ? ((await announcementsRes.json()) as Announcement[])
    : []
  const events: Array<{
    id: string
    title: string
    place: string
    location: string
    eventUrl: string | null
    startAt: string
  }> = eventsRes.ok ? await eventsRes.json() : []
  const posts: Array<{
    id: string
    title: string | null
    body: string
    images: string[]
    publishAt: string
    createdAt: string
  }> = postsRes.ok ? await postsRes.json() : []
  const embeds: Array<{ id: string; url: string; title: string | null }> = embedsRes.ok
    ? await embedsRes.json()
    : []

  const isOwnerOrAdmin = !!user && (user.username === channel.user.username || user.isBoard)
  let manageStats: ManageStats | null = null
  if (isOwnerOrAdmin) {
    const sessionCookie = cookies().get('tahti_session')
    if (sessionCookie) {
      try {
        const statsRes = await fetch(`${apiUrl}/api/channels/${slug}/manage-stats`, {
          headers: { Cookie: `tahti_session=${sessionCookie.value}` },
          cache: 'no-store',
        })
        if (statsRes.ok) manageStats = (await statsRes.json()) as ManageStats
      } catch {
        manageStats = null
      }
    }
  }

  const hlsUrl = channel.hlsUrl
  // Only show the Live tab when there's actually a stream to show — otherwise
  // it sits in the tab bar permanently empty. Bio (with a latest-releases
  // preview) is the landing tab the rest of the time (see PublicChannelTabs).
  const showLiveTab = Boolean(hlsUrl)
  // Tahti Radio and Tahti Selects are always-on curated rotations, not a human
  // actually broadcasting — channel.state is still 'LIVE' while they run, but
  // "LIVE NOW" is misleading here; show the currently-rotating track instead.
  const isRotationChannel = slug === TAHTI_RADIO_SLUG || slug === TAHTI_SELECTS_SLUG
  const bioHtml = channel.user.bio ? await renderBio(channel.user.bio) : null
  const channelBackdrop = resolveArchiveBackground(channel.videoBackgroundUrl ?? null)
  const socialLinks = (channel.user.socialLinks as Record<string, string> | null) ?? {}
  const profileGenres = socialLinks.genres
    ? socialLinks.genres
        .split(',')
        .map((g) => g.trim())
        .filter(Boolean)
    : []
  const STREAMING_LINK_LABELS: Record<string, string> = {
    youtube: 'YouTube',
    hearthisAt: 'hearthis.at',
    twitch: 'Twitch',
    soundcloud: 'SoundCloud',
    kick: 'Kick',
  }
  const streamingLinkEntries = Object.entries(STREAMING_LINK_LABELS)
    .map(([key, label]) => [label, socialLinks[key]] as const)
    .filter(([, url]) => !!url)
  const kickUsername = socialLinks.kick ? kickUsernameFromUrl(socialLinks.kick) : null
  const socialLinkEntries = Object.entries(socialLinks).filter(
    ([key, url]) => key !== 'genres' && !(key in STREAMING_LINK_LABELS) && url,
  )
  let tags = profileGenres
  if (tags.length === 0) {
    const tagSet = new Set<string>()
    for (const item of items) {
      if (item.genre?.trim()) tagSet.add(item.genre.trim())
      if (item.genreCustom?.trim()) tagSet.add(item.genreCustom.trim())
    }
    tags = [...tagSet].slice(0, 8)
  }

  let listenerCount: number | null = null
  if (channel.state === 'LIVE') {
    try {
      const presenceRes = await fetch(`${apiUrl}/api/channels/${slug}/presence`, {
        cache: 'no-store',
      })
      if (presenceRes.ok) {
        const data = (await presenceRes.json()) as { numClients: number }
        listenerCount = data.numClients
      }
    } catch {
      listenerCount = null
    }
  }

  function fmtDuration(secs: number): string {
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    if (h > 0) return `${h}h ${m}m`
    return `${m}m`
  }

  return (
    <ChannelPageShell
      isLive={channel.state === 'LIVE'}
      artistHandle={channel.user.username}
      listenerCount={listenerCount}
      user={user}
      logoutAction={logout}
      main={
        <ChannelTabs
          isOwnerOrAdmin={isOwnerOrAdmin}
          manage={
            isOwnerOrAdmin && manageStats ? (
              <ManagePanel slug={slug} initialStats={manageStats} />
            ) : null
          }
        >
          <div className="ch-page-content">
            <ChannelColorScheme colorSchemeJson={channel.colorSchemeJson} />

            <ChannelPageVisualizer
              preset={(channel.visualPreset ?? 'MINIMAL') as VisualPreset}
              colorSchemeJson={channel.colorSchemeJson}
              settings={resolveVisualPresetSettings(
                parseVisualSettingsMap(channel.visualSettingsJson),
                (channel.visualPreset ?? 'MINIMAL') as VisualPreset,
              )}
            />

            <div className="ch-page-foreground">
              {channelBackdrop.videoEmbedUrl && (
                <ArchiveVideoBackdrop embedUrl={channelBackdrop.videoEmbedUrl} />
              )}
              {channelBackdrop.cssImageUrl && !channelBackdrop.videoEmbedUrl && (
                <div
                  className="ch-channel-backdrop"
                  style={{ ['--ch-backdrop-image' as string]: channelBackdrop.cssImageUrl }}
                />
              )}
              <header className="ch-artist-header">
                <Row className="ui-row--gap-3 ch-artist-header-row">
                  <AvatarTile
                    size="md"
                    name={channel.user.displayName}
                    src={channel.user.avatarUrl}
                    bordered
                    className="ch-artist-avatar"
                  />
                  <div>
                    <Heading level={1} className="ch-artist-name">
                      {channel.user.displayName}
                      {channel.user.pronouns && (
                        <span className="prof-pronouns">{channel.user.pronouns}</span>
                      )}
                    </Heading>
                    <Text size="sm" tone="muted" className="ch-artist-meta-row">
                      @{channel.user.username}
                      <span className="ch-artist-flag">
                        {channel.user.countryCode
                          ? countryCodeToFlag(channel.user.countryCode)
                          : '🌍'}{' '}
                        {channel.user.countryCode
                          ? countryName(channel.user.countryCode)
                          : 'World citizen'}
                      </span>
                      {formatJoinDateLabel(channel.user.joinDate) && (
                        <span className="ch-artist-flag">
                          {formatJoinDateLabel(channel.user.joinDate)}
                        </span>
                      )}
                    </Text>
                  </div>
                </Row>
                <div className="ch-artist-cta-row">
                  {user?.username !== channel.user.username && (
                    <FollowButton artistUsername={channel.user.username} />
                  )}
                  {showSupport && (
                    <Link
                      href={`/u/${channel.user.username}/subscribe`}
                      className="ch-artist-sub-btn"
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 16 16"
                        fill="currentColor"
                        aria-hidden
                      >
                        <path d="M8 13.8 2.6 8.7C1 7.2 1 4.7 2.6 3.3c1.5-1.3 3.7-1 5 .5L8 4.3l.4-.5c1.3-1.5 3.5-1.8 5-.5 1.6 1.4 1.6 3.9 0 5.4L8 13.8z" />
                      </svg>
                      Support
                    </Link>
                  )}
                  <Link href={`/u/${channel.user.username}`} className="ch-artist-profile-link">
                    Profile
                  </Link>
                  <GalleryPhotosButton images={channel.slideshowImages} />
                  <HelpTourButton
                    steps={getPublicTourSteps(`/c/${params.slug}`)}
                    className="studio-top-nav__notif-btn"
                  />
                </div>
              </header>

              {/* Ambient decoration (text layer + slideshow/gallery) — the
                  artist's own configured backdrop, not tied to whether
                  there's an active program. Shows on every tab, including
                  Bio, so "no program playing" doesn't mean a blank page. */}
              <ChannelTextLayerView
                mode={channel.textLayerMode}
                text={channel.textLayerText}
                align={channel.textLayerAlign}
              />

              {channel.galleryMode === 'STATIC_SLIDESHOW' && channel.slideshowImages.length > 0 ? (
                <ChannelSlideshow
                  images={channel.slideshowImages}
                  preset={
                    (channel.slideshowPreset ?? 'FADE') as import('@tahti/shared').SlideshowPreset
                  }
                  intervalSeconds={channel.slideshowIntervalSeconds ?? 8}
                  transitionMs={channel.slideshowTransitionMs ?? 600}
                  autoplay={channel.slideshowAutoplay ?? true}
                />
              ) : (
                <ChannelGalleryView mode={channel.galleryMode} images={channel.slideshowImages} />
              )}

              <PublicChannelTabs
                live={
                  showLiveTab ? (
                    <>
                      {hlsUrl && (
                        <LivePlayerSection
                          url={hlsUrl}
                          slug={slug}
                          title={
                            isRotationChannel
                              ? (channel.nowPlaying?.title ?? channel.user.displayName)
                              : channel.user.displayName
                          }
                          subtitle={
                            isRotationChannel && channel.nowPlaying
                              ? channel.nowPlaying.artistName
                              : undefined
                          }
                          subtitleHref={
                            isRotationChannel && channel.nowPlaying?.artistUsername
                              ? `/u/${channel.nowPlaying.artistUsername}`
                              : undefined
                          }
                          artworkUrl={
                            isRotationChannel
                              ? channel.nowPlaying?.artworkUrl
                              : channel.user.avatarUrl
                          }
                          isReplay={isRotationChannel}
                          nextUpLabel={
                            isRotationChannel && channel.nowPlayingNext
                              ? `${channel.nowPlayingNext.title} — ${channel.nowPlayingNext.artistName}`
                              : undefined
                          }
                          isRotationChannel={isRotationChannel}
                          colorSchemeJson={channel.colorSchemeJson}
                          visualPreset={(channel.visualPreset ?? 'MINIMAL') as VisualPreset}
                          visualSettingsJson={channel.visualSettingsJson}
                          initialNowPlaying={channel.nowPlaying}
                          initialNowPlayingNext={channel.nowPlayingNext}
                        />
                      )}

                      {channel.state === 'LIVE' && <LiveTracklistPanel slug={slug} />}
                    </>
                  ) : undefined
                }
                archive={
                  <>
                    {embeds.length > 0 && (
                      <section className="ch-archive-section">
                        <div className="ch-archive-section-head">
                          <h2 className="ch-section-label">Listen on SoundCloud</h2>
                        </div>
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

                    {kickUsername && (
                      <section className="ch-archive-section">
                        <div className="ch-archive-section-head">
                          <h2 className="ch-section-label">Live on Kick</h2>
                        </div>
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
                    )}

                    <section className="ch-archive-section">
                      <div className="ch-archive-section-head">
                        <h2 className="ch-section-label">Archive</h2>
                        <a
                          href={channelArchiveRssUrl(apiUrl, slug)}
                          className="ch-rss-link"
                          rel="alternate"
                        >
                          RSS ↗
                        </a>
                      </div>

                      {channel.state !== 'LIVE' && channel.nextBroadcastAt && (
                        <BroadcastCountdown
                          targetIso={channel.nextBroadcastAt}
                          note={channel.nextBroadcastNote}
                        />
                      )}
                      {channel.state !== 'LIVE' &&
                        !channel.nextBroadcastAt &&
                        channel.nextBroadcastNote && (
                          <div className="ch-next-broadcast" role="status">
                            <SafePlainText
                              text={channel.nextBroadcastNote}
                              className="ch-next-broadcast-note"
                            />
                          </div>
                        )}

                      {items.length === 0 ? (
                        <div className="public-empty-card">
                          <p className="public-empty-card__text">No archive items yet.</p>
                          <p className="public-empty-card__hint">
                            Past broadcasts appear here once published from the studio.
                          </p>
                        </div>
                      ) : (
                        <ul className="ch-archive-list">
                          {items.map((item) => {
                            const { cssImageUrl, videoEmbedUrl } = resolveArchiveBackground(
                              item.backgroundUrl,
                            )
                            return (
                              <li
                                key={item.id}
                                id={`archive-item-${item.id}`}
                                className={`ch-archive-item${cssImageUrl ? ' ch-archive-item--bg' : ''}`}
                                style={
                                  cssImageUrl
                                    ? { ['--ch-item-bg' as string]: cssImageUrl }
                                    : undefined
                                }
                              >
                                {videoEmbedUrl && <ArchiveVideoBackdrop embedUrl={videoEmbedUrl} />}
                                <div className="ch-archive-item-header">
                                  <span style={{ position: 'relative', display: 'inline-flex' }}>
                                    {item.bannerUrl ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img
                                        src={item.bannerUrl}
                                        alt=""
                                        className="ch-archive-item-thumb"
                                      />
                                    ) : (
                                      <AvatarTile size="xs" name={item.title} />
                                    )}
                                    {ranks[item.id] && <RankBadge rank={ranks[item.id]!} />}
                                  </span>
                                  <div className="ch-archive-item-meta">
                                    <div className="ch-archive-item-meta-main">
                                      <div className="ch-archive-item-title">{item.title}</div>
                                      {item.artistName ? (
                                        <div className="ch-archive-item-credit">
                                          <span>{item.artistName}</span>
                                        </div>
                                      ) : null}
                                    </div>
                                    <div className="ch-archive-item-date">
                                      {new Date(item.createdAt).toLocaleDateString(undefined, {
                                        year: 'numeric',
                                        month: 'short',
                                      })}
                                      {item.durationSec != null && (
                                        <> · {fmtDuration(item.durationSec)}</>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                {(() => {
                                  const hasCredits = Boolean(
                                    item.credits && item.credits.length > 0,
                                  )
                                  const hasGallery = Boolean(
                                    item.slideshowUrls && item.slideshowUrls.length > 0,
                                  )
                                  const hasDesc = Boolean(item.description)
                                  const hasCommentary = Boolean(item.commentary)
                                  const hasTracklist = Boolean(
                                    item.tracklist && item.tracklist.length > 0,
                                  )
                                  const hasDetails =
                                    hasCredits ||
                                    hasGallery ||
                                    hasDesc ||
                                    hasCommentary ||
                                    hasTracklist
                                  if (!hasDetails) return null
                                  return (
                                    <details className="ch-archive-item-details">
                                      <summary className="ch-archive-item-details__summary">
                                        Details
                                      </summary>
                                      <div className="ch-archive-item-details__body">
                                        {hasCredits ? (
                                          <div className="ch-archive-item-credit ch-archive-item-credit--roles">
                                            {item.credits!.map((c, i) => (
                                              <span key={`${c.role}-${c.name}-${i}`}>
                                                {i > 0 ? ' · ' : null}
                                                {c.role}:{' '}
                                                {c.artistUsername ? (
                                                  <a
                                                    href={`/u/${c.artistUsername}`}
                                                    className="ch-archive-item-credit__link"
                                                  >
                                                    {c.name}
                                                  </a>
                                                ) : (
                                                  c.name
                                                )}
                                              </span>
                                            ))}
                                          </div>
                                        ) : null}
                                        {hasGallery ? (
                                          <ArchiveItemGallery
                                            itemId={item.id}
                                            images={item.slideshowUrls!}
                                            galleryMode={item.galleryMode ?? 'NONE'}
                                            audioReactive={Boolean(item.galleryAudioReactive)}
                                          />
                                        ) : null}
                                        {hasDesc ? (
                                          <SafePlainText
                                            text={item.description!}
                                            className="ch-archive-item-desc"
                                          />
                                        ) : null}
                                        {hasCommentary ? (
                                          <SafePlainText
                                            text={item.commentary!}
                                            className="ch-archive-item-commentary"
                                          />
                                        ) : null}
                                        {hasTracklist ? (
                                          <TracklistView entries={item.tracklist!} />
                                        ) : null}
                                      </div>
                                    </details>
                                  )
                                })()}
                                {item.audioUrl ? (
                                  <ArchiveItemPlayback
                                    channelSlug={slug}
                                    artistUsername={channel.user.username}
                                    artistCredit={item.artistName}
                                    item={{ ...item, audioUrl: item.audioUrl }}
                                    colorSchemeJson={channel.colorSchemeJson}
                                    isLoggedIn={!!user}
                                    queue={archiveQueue}
                                  />
                                ) : (
                                  <>
                                    <TrackCommentsToggle
                                      archiveItemId={item.id}
                                      isLoggedIn={!!user}
                                      commentCount={item.commentCount ?? 0}
                                    />
                                    <ReportButton targetType="ARCHIVE_ITEM" targetId={item.id} />
                                  </>
                                )}
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </section>
                  </>
                }
                releases={
                  releases.length === 0 ? (
                    <div className="public-empty-card">
                      <p className="public-empty-card__text">No published releases yet.</p>
                      <p className="public-empty-card__hint">
                        New releases appear here when the artist publishes.
                      </p>
                    </div>
                  ) : (
                    <ReleasesGrid releases={releases} />
                  )
                }
                feed={
                  <>
                    {posts.length > 0 && (
                      <section className="ch-featured-post">
                        <div className="ch-featured-post__label">
                          Latest from {channel.user.displayName}
                        </div>
                        {posts[0]!.title && (
                          <div className="ch-posts-list__title">{posts[0]!.title}</div>
                        )}
                        <div className="ch-posts-list__date">
                          {new Date(posts[0]!.publishAt).toLocaleDateString(undefined, {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </div>
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

                    {events.length > 0 && (
                      <section className="ch-archive-section">
                        <div className="ch-archive-section-head">
                          <h2 className="ch-section-label">Events</h2>
                        </div>
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
                      <section className="ch-archive-section">
                        <div className="ch-archive-section-head">
                          <h2 className="ch-section-label">Updates</h2>
                        </div>
                        <ul className="ch-posts-list">
                          {posts.slice(1).map((p) => (
                            <li key={p.id} className="ch-posts-list__item">
                              {p.title && <div className="ch-posts-list__title">{p.title}</div>}
                              <div className="ch-posts-list__date">
                                {new Date(p.publishAt).toLocaleDateString(undefined, {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })}
                              </div>
                              <p className="ch-posts-list__body">{p.body}</p>
                              {p.images.length > 0 && (
                                <div className="ch-posts-list__images">
                                  {p.images.map((url) => (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      key={url}
                                      src={url}
                                      alt=""
                                      className="ch-posts-list__image"
                                    />
                                  ))}
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      </section>
                    )}

                    {posts.length === 0 && events.length === 0 && (
                      <div className="public-empty-card">
                        <p className="public-empty-card__text">No updates yet.</p>
                        <p className="public-empty-card__hint">
                          Posts and upcoming shows will land here. Past broadcasts are in Archive.
                        </p>
                        <Link
                          href={`/u/${channel.user.username}`}
                          className="public-empty-card__cta"
                        >
                          View profile →
                        </Link>
                      </div>
                    )}
                  </>
                }
                bio={
                  <>
                    {bioHtml ? (
                      <div
                        className="ch-artist-bio ch-artist-bio--rich"
                        dangerouslySetInnerHTML={{ __html: bioHtml }}
                      />
                    ) : channel.user.bio ? (
                      <SafePlainText
                        text={channel.user.bio}
                        className="ch-artist-bio"
                        linkMentions
                      />
                    ) : (
                      <div className="public-empty-card">
                        <p className="public-empty-card__text">No bio yet.</p>
                      </div>
                    )}
                    {releases.length > 0 && (
                      <section className="ch-archive-section">
                        <div className="ch-archive-section-head">
                          <h2 className="ch-section-label">Latest releases</h2>
                        </div>
                        <ReleasesGrid releases={releases.slice(0, 4)} />
                      </section>
                    )}
                    {tags.length > 0 && (
                      <div className="prof-tags">
                        {tags.map((tag) => (
                          <span key={tag} className="prof-tag-chip">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    {streamingLinkEntries.length > 0 && (
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
                    )}
                    {socialLinkEntries.length > 0 && (
                      <div className="prof-social-links">
                        {socialLinkEntries.map(([key, url]) => {
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
                    )}
                  </>
                }
              />
            </div>
          </div>
        </ChannelTabs>
      }
      sidebar={
        <>
          {channel.user.chatEnabled !== false ? (
            <>
              <ChatPanel
                slug={slug}
                announcements={announcements}
                isLoggedIn={Boolean(user)}
                accountHandle={user?.displayName}
              />
              <FanChatPanel slug={slug} />
            </>
          ) : (
            <p className="ch-chat-disabled-note">
              {channel.user.displayName} has turned off chat for this channel.
            </p>
          )}
          <ReportButton targetType="CHANNEL" targetId={slug} />
        </>
      }
    />
  )
}
