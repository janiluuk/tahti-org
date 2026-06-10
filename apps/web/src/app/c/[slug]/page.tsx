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
import { BroadcastCountdown } from './broadcast-countdown'
import { StickyLiveBar } from './sticky-live-bar'
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

  const [itemsRes, announcementsRes, user] = await Promise.all([
    fetch(`${apiUrl}/api/channels/${slug}/items`, { cache: 'no-store' }),
    fetch(`${apiUrl}/api/chat/${slug}/announcements`, { cache: 'no-store' }),
    getSessionUser(),
  ])

  const items: ArchiveItem[] = itemsRes.ok ? ((await itemsRes.json()) as ArchiveItem[]) : []
  const announcements: Announcement[] = announcementsRes.ok
    ? ((await announcementsRes.json()) as Announcement[])
    : []

  const hlsUrl = channel.hlsUrl
  const bioHtml = channel.user.bio ? await renderBio(channel.user.bio) : null
  const channelBackdrop = resolveArchiveBackground(channel.videoBackgroundUrl ?? null)
  const isFlac = channel.user.tier === 'STUDIO' || channel.user.tier === 'ARTIST'
  const tagSet = new Set<string>()
  for (const item of items) {
    if (item.genre?.trim()) tagSet.add(item.genre.trim())
    if (item.genreCustom?.trim()) tagSet.add(item.genreCustom.trim())
  }
  const tags = [...tagSet].slice(0, 8)

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
            {channel.state === 'LIVE' && (
              <StickyLiveBar slug={slug} artistName={channel.user.displayName} isFlac={isFlac} />
            )}
            {channelBackdrop.videoEmbedUrl && (
              <ArchiveVideoBackdrop embedUrl={channelBackdrop.videoEmbedUrl} />
            )}
            {channelBackdrop.imageUrl && !channelBackdrop.videoEmbedUrl && (
              <div
                className="ch-channel-backdrop"
                style={{ ['--ch-backdrop-image' as string]: `url(${channelBackdrop.imageUrl})` }}
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
                  </Heading>
                  <Text size="sm" tone="muted">
                    @{channel.user.username}
                    {channel.user.countryCode && (
                      <span
                        className="ch-artist-flag"
                        title={channel.user.countryCode}
                        aria-label={channel.user.countryCode}
                      >
                        {countryCodeToFlag(channel.user.countryCode)}
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
            />

            {channel.state !== 'LIVE' && channel.nextBroadcastAt && (
              <BroadcastCountdown
                targetIso={channel.nextBroadcastAt}
                note={channel.nextBroadcastNote}
              />
            )}
            {channel.state !== 'LIVE' && !channel.nextBroadcastAt && channel.nextBroadcastNote && (
              <div className="ch-next-broadcast" role="status">
                <SafePlainText
                  text={channel.nextBroadcastNote}
                  className="ch-next-broadcast-note"
                />
              </div>
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

            {hlsUrl && <LivePlayerSection url={hlsUrl} slug={slug} />}

            {channel.state === 'LIVE' && <LiveTracklistPanel slug={slug} />}

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

              {items.length === 0 ? (
                <p className="ch-archive-empty">No archive items yet.</p>
              ) : (
                <ul className="ch-archive-list">
                  {items.map((item) => {
                    const { imageUrl, videoEmbedUrl } = resolveArchiveBackground(item.backgroundUrl)
                    return (
                      <li
                        key={item.id}
                        id={`archive-item-${item.id}`}
                        className={`ch-archive-item${imageUrl ? ' ch-archive-item--bg' : ''}`}
                        style={
                          imageUrl ? { ['--ch-item-bg' as string]: `url(${imageUrl})` } : undefined
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
        </>
      }
    />
  )
}
