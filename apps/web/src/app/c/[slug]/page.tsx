// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { TAHTI_RADIO_SLUG, TAHTI_SELECTS_SLUG } from '@tahti/shared'
import ChatPanel from './chat-panel'
import FanChatPanel from './fan-chat-panel'
import { LivePlayerSection } from './live-player-section'
import { LiveTracklistPanel } from '@/components/live-tracklist-panel'
import { ChannelGalleryView } from './channel-gallery'
import { ChannelTextLayerView } from '@/components/text-layer'
import { ChannelVisualizer } from '@/components/visuals/channel-visualizer'
import { ChannelColorScheme } from '@/components/visuals/channel-color-scheme'
import { ChannelSlideshow } from '@/components/visuals/channel-slideshow'
import { TracklistView } from '@/components/tracklist/tracklist-view'
import { ArchiveItemPlayback } from './archive-item-playback'
import { BroadcastCountdown } from '@/components/broadcast-countdown'
import { ArchiveVideoBackdrop, resolveArchiveBackground } from './archive-item-backdrop'
import type {
  ChannelGalleryMode,
  ChannelTextLayerAlignment,
  ChannelTextLayerMode,
  TracklistEntry,
} from '@tahti/shared'
import { AvatarTile, Heading, Row, Text, ChannelPageShell, SafePlainText } from '@tahti/ui'
import { channelArchiveRssUrl } from '@/lib/rss-feeds'
import { getSessionUser } from '@/lib/session'
import { renderBio } from '@/lib/render-bio'
import { flagEmoji as countryCodeToFlag } from '@/lib/flag-emoji'
import { countryName } from '@/lib/country-options'
import { SocialLinkIcon, kickUsernameFromUrl } from '@/components/social-link-icon'
import { ReportButton } from '@/components/report-button'
import { TrackCommentsToggle } from '@/components/track-comments-toggle'

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
    notFound()
  }

  if (!channelRes.ok) {
    throw new Error('Failed to load channel')
  }

  const channel = (await channelRes.json()) as ChannelResponse

  const [itemsRes, announcementsRes, eventsRes, postsRes, embedsRes, user] = await Promise.all([
    fetch(`${apiUrl}/api/channels/${slug}/items`, { cache: 'no-store' }),
    fetch(`${apiUrl}/api/chat/${slug}/announcements`, { cache: 'no-store' }),
    fetch(`${apiUrl}/api/channels/${slug}/events`, { cache: 'no-store' }),
    fetch(`${apiUrl}/api/channels/${slug}/posts`, { cache: 'no-store' }),
    fetch(`${apiUrl}/api/channels/${slug}/embeds`, { cache: 'no-store' }),
    getSessionUser(),
  ])

  const items: ArchiveItem[] = itemsRes.ok ? ((await itemsRes.json()) as ArchiveItem[]) : []
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

  const hlsUrl = channel.hlsUrl
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
      main={
        <div className="ch-page-content">
          <ChannelColorScheme colorSchemeJson={channel.colorSchemeJson} />

          {channel.visualPreset && channel.visualPreset !== 'MINIMAL' && (
            <ChannelVisualizer
              preset={channel.visualPreset as import('@tahti/shared').VisualPreset}
              colorSchemeJson={channel.colorSchemeJson}
              className="ch-page-visualizer"
            />
          )}

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
                  size="sm"
                  name={channel.user.displayName}
                  src={channel.user.avatarUrl}
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
              {bioHtml ? (
                <div
                  className="ch-artist-bio ch-artist-bio--rich"
                  dangerouslySetInnerHTML={{ __html: bioHtml }}
                />
              ) : (
                channel.user.bio && (
                  <SafePlainText text={channel.user.bio} className="ch-artist-bio" linkMentions />
                )
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
              <div className="ch-artist-cta-row">
                <Link href={`/u/${channel.user.username}/subscribe`} className="ch-artist-sub-btn">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
                    <path d="M8 13.8 2.6 8.7C1 7.2 1 4.7 2.6 3.3c1.5-1.3 3.7-1 5 .5L8 4.3l.4-.5c1.3-1.5 3.5-1.8 5-.5 1.6 1.4 1.6 3.9 0 5.4L8 13.8z" />
                  </svg>
                  Support directly
                </Link>
                <Link href={`/u/${channel.user.username}`} className="ch-artist-profile-link">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
                    <circle cx="8" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.3" />
                    <path
                      d="M3 13.5c0-2.5 2.2-4.5 5-4.5s5 2 5 4.5"
                      stroke="currentColor"
                      strokeWidth="1.3"
                      strokeLinecap="round"
                    />
                  </svg>
                  View profile
                </Link>
              </div>
            </header>

            {posts.length > 0 && (
              <section className="ch-featured-post">
                <div className="ch-featured-post__label">
                  Latest from {channel.user.displayName}
                </div>
                {posts[0]!.title && <div className="ch-posts-list__title">{posts[0]!.title}</div>}
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
                artworkUrl={isRotationChannel ? channel.nowPlaying?.artworkUrl : undefined}
                isReplay={isRotationChannel}
                nextUpLabel={
                  isRotationChannel && channel.nowPlayingNext
                    ? `${channel.nowPlayingNext.title} — ${channel.nowPlayingNext.artistName}`
                    : undefined
                }
              />
            )}

            {channel.state === 'LIVE' && <LiveTracklistPanel slug={slug} />}

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
                          cssImageUrl ? { ['--ch-item-bg' as string]: cssImageUrl } : undefined
                        }
                      >
                        {videoEmbedUrl && <ArchiveVideoBackdrop embedUrl={videoEmbedUrl} />}
                        <div className="ch-archive-item-header">
                          {item.bannerUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.bannerUrl} alt="" className="ch-archive-item-thumb" />
                          ) : (
                            <AvatarTile size="sm" name={item.title} />
                          )}
                          <div className="ch-archive-item-meta">
                            <div className="ch-archive-item-title">{item.title}</div>
                            <div className="ch-archive-item-date">
                              {new Date(item.createdAt).toLocaleDateString(undefined, {
                                year: 'numeric',
                                month: 'short',
                              })}
                              {item.durationSec != null && <> · {fmtDuration(item.durationSec)}</>}
                            </div>
                          </div>
                        </div>
                        {item.slideshowUrls && item.slideshowUrls.length > 0 && (
                          <div className="ch-archive-slideshow">
                            {item.slideshowUrls.map((url) => (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img key={url} src={url} alt="" />
                            ))}
                          </div>
                        )}
                        {item.description && (
                          <SafePlainText text={item.description} className="ch-archive-item-desc" />
                        )}
                        {item.commentary && (
                          <SafePlainText
                            text={item.commentary}
                            className="ch-archive-item-commentary"
                          />
                        )}
                        {item.tracklist && item.tracklist.length > 0 && (
                          <TracklistView entries={item.tracklist} />
                        )}
                        {item.audioUrl ? (
                          <ArchiveItemPlayback
                            channelSlug={slug}
                            artistUsername={channel.user.username}
                            item={{ ...item, audioUrl: item.audioUrl }}
                            colorSchemeJson={channel.colorSchemeJson}
                            isLoggedIn={!!user}
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
          </div>
        </div>
      }
      sidebar={
        <>
          <ChatPanel slug={slug} announcements={announcements} />
          <FanChatPanel slug={slug} />
          <ReportButton targetType="CHANNEL" targetId={slug} />
        </>
      }
    />
  )
}
