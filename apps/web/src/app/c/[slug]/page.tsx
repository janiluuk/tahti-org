// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { notFound } from 'next/navigation'
import ChatPanel from './chat-panel'
import FanChatPanel from './fan-chat-panel'
import { LivePlayerSection } from './live-player-section'
import { LiveTracklistPanel } from '@/components/live-tracklist-panel'
import { ChannelGalleryView } from './channel-gallery'
import { ChannelTextLayerView } from '@/components/text-layer'
import { TracklistView } from '@/components/tracklist/tracklist-view'
import { ArchiveWaveform } from '@/components/archive-waveform'
import { ArchiveDownloadButton } from './archive-download'
import { BroadcastCountdown } from './broadcast-countdown'
import { StickyLiveBar } from './sticky-live-bar'
import { ArchiveVideoBackdrop, resolveArchiveBackground } from './archive-item-backdrop'
import type {
  ChannelGalleryMode,
  ChannelTextLayerAlignment,
  ChannelTextLayerMode,
  TracklistEntry,
} from '@tahti/shared'
import { Heading, Row, Text, ChannelPageLayout, LiveBadge, SafePlainText } from '@tahti/ui'
import { NewsletterSubscribeForm } from '@/components/newsletter-subscribe-form'
import { channelArchiveRssUrl } from '@/lib/rss-feeds'

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
  user: {
    username: string
    displayName: string
    bio: string | null
    avatarUrl: string | null
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

  const [itemsRes, announcementsRes] = await Promise.all([
    fetch(`${apiUrl}/api/channels/${slug}/items`, { cache: 'no-store' }),
    fetch(`${apiUrl}/api/chat/${slug}/announcements`, { cache: 'no-store' }),
  ])

  const items: ArchiveItem[] = itemsRes.ok ? ((await itemsRes.json()) as ArchiveItem[]) : []
  const announcements: Announcement[] = announcementsRes.ok
    ? ((await announcementsRes.json()) as Announcement[])
    : []

  const hlsUrl = channel.hlsUrl
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
    <ChannelPageLayout
      isLive={channel.state === 'LIVE'}
      artistHandle={channel.user.username}
      main={
        <>
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
              {channel.user.avatarUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={channel.user.avatarUrl}
                  alt={channel.user.displayName}
                  width={64}
                  height={64}
                  className="ch-artist-avatar"
                />
              )}
              <div>
                <Heading level={1} className="ch-artist-name">
                  {channel.user.displayName}
                </Heading>
                <Text size="sm" tone="muted">
                  @{channel.user.username}
                </Text>
              </div>
              {channel.state === 'LIVE' && <LiveBadge />}
            </Row>
            {channel.user.bio && (
              <SafePlainText text={channel.user.bio} className="ch-artist-bio" linkMentions />
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
              <SafePlainText text={channel.nextBroadcastNote} className="ch-next-broadcast-note" />
            </div>
          )}

          <ChannelTextLayerView
            mode={channel.textLayerMode}
            text={channel.textLayerText}
            align={channel.textLayerAlign}
          />

          <ChannelGalleryView mode={channel.galleryMode} images={channel.slideshowImages} />

          {hlsUrl && <LivePlayerSection url={hlsUrl} slug={slug} />}

          {channel.state === 'LIVE' && <LiveTracklistPanel slug={slug} />}

          <section className="ch-archive-section">
            <div className="ch-archive-section-head">
              <h2 className="ch-section-label">Archive</h2>
              <a href={channelArchiveRssUrl(apiUrl, slug)} className="ch-rss-link" rel="alternate">
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
                        <>
                          <ArchiveWaveform peaks={item.peaks} />
                          <audio
                            controls
                            src={item.audioUrl}
                            className="ch-archive-audio"
                            data-testid="channel-archive-player"
                          />
                        </>
                      )}
                      <ArchiveDownloadButton
                        channelSlug={slug}
                        artistUsername={channel.user.username}
                        itemId={item.id}
                        repostToDownload={Boolean(item.repostToDownload)}
                        followToDownload={Boolean(item.followToDownload)}
                      />
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </>
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
