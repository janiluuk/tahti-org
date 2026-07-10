// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { notFound } from 'next/navigation'
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
import { NewsletterSubscribeForm } from '@/components/newsletter-subscribe-form'
import { channelArchiveRssUrl } from '@/lib/rss-feeds'
import { getSessionUser } from '@/lib/session'
import { renderBio } from '@/lib/render-bio'
import { flagEmoji as countryCodeToFlag } from '@/lib/flag-emoji'
import { countryName } from '@/lib/country-options'
import { SocialLinkIcon } from '@/components/social-link-icon'
import { ReportButton } from '@/components/report-button'

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
  }
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

  const [itemsRes, announcementsRes, eventsRes, postsRes, user] = await Promise.all([
    fetch(`${apiUrl}/api/channels/${slug}/items`, { cache: 'no-store' }),
    fetch(`${apiUrl}/api/chat/${slug}/announcements`, { cache: 'no-store' }),
    fetch(`${apiUrl}/api/channels/${slug}/events`, { cache: 'no-store' }),
    fetch(`${apiUrl}/api/channels/${slug}/posts`, { cache: 'no-store' }),
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
    createdAt: string
  }> = postsRes.ok ? await postsRes.json() : []

  const hlsUrl = channel.hlsUrl
  const bioHtml = channel.user.bio ? await renderBio(channel.user.bio) : null
  const channelBackdrop = resolveArchiveBackground(channel.videoBackgroundUrl ?? null)
  const socialLinks = (channel.user.socialLinks as Record<string, string> | null) ?? {}
  const profileGenres = socialLinks.genres
    ? socialLinks.genres
        .split(',')
        .map((g) => g.trim())
        .filter(Boolean)
    : []
  const socialLinkEntries = Object.entries(socialLinks).filter(
    ([key, url]) => key !== 'genres' && url,
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
                  <Text size="sm" tone="muted">
                    @{channel.user.username}
                    <span className="ch-artist-flag">
                      {channel.user.countryCode
                        ? countryCodeToFlag(channel.user.countryCode)
                        : '🌍'}{' '}
                      {channel.user.countryCode
                        ? countryName(channel.user.countryCode)
                        : 'World citizen'}
                    </span>
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
                <a href={`/u/${channel.user.username}/subscribe`} className="ch-artist-sub-btn">
                  Support directly
                </a>
                <a href={`/u/${channel.user.username}`} className="ch-artist-profile-link">
                  View profile →
                </a>
              </div>
            </header>

            <NewsletterSubscribeForm
              artistUsername={channel.user.username}
              artistDisplayName={channel.user.displayName}
              isLoggedIn={Boolean(user)}
            />

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
              <LivePlayerSection url={hlsUrl} slug={slug} title={channel.user.displayName} />
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

            {posts.length > 0 && (
              <section className="ch-archive-section">
                <div className="ch-archive-section-head">
                  <h2 className="ch-section-label">Updates</h2>
                </div>
                <ul className="ch-posts-list">
                  {posts.map((p) => (
                    <li key={p.id} className="ch-posts-list__item">
                      {p.title && <div className="ch-posts-list__title">{p.title}</div>}
                      <div className="ch-posts-list__date">
                        {new Date(p.createdAt).toLocaleDateString(undefined, {
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
                          {item.bannerUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.bannerUrl} alt="" className="ch-archive-item-thumb" />
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
                        {item.audioUrl && (
                          <ArchiveItemPlayback
                            channelSlug={slug}
                            artistUsername={channel.user.username}
                            item={{ ...item, audioUrl: item.audioUrl }}
                            colorSchemeJson={channel.colorSchemeJson}
                          />
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
