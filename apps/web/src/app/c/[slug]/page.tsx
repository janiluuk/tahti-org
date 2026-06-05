// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { notFound } from 'next/navigation'
import ChatPanel from './chat-panel'
import FanChatPanel from './fan-chat-panel'
import HlsPlayer from './hls-player'
import ReactionsOverlay from './reactions'
import { ChannelGalleryView } from './channel-gallery'
import { ChannelTextLayerView } from '@/components/text-layer'
import { TracklistView } from '@/components/tracklist/tracklist-view'
import { ArchiveDownloadButton } from './archive-download'
import { ArchiveVideoBackdrop, resolveArchiveBackground } from './archive-item-backdrop'
import type {
  ChannelGalleryMode,
  ChannelTextLayerAlignment,
  ChannelTextLayerMode,
  TracklistEntry,
} from '@tahti/shared'
import { Heading, Row, Text, ChannelPageLayout, LiveBadge, SafePlainText } from '@tahti/ui'

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
  }
}

interface ArchiveItem {
  id: string
  title: string
  description: string | null
  commentary: string | null
  durationSec: number | null
  audioUrl: string | null
  createdAt: string
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

  return (
    <ChannelPageLayout
      isLive={channel.state === 'LIVE'}
      main={
        <>
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
              <SafePlainText text={channel.user.bio} className="ch-artist-bio" />
            )}
          </header>

          {channel.state !== 'LIVE' && (channel.nextBroadcastAt || channel.nextBroadcastNote) && (
            <div className="ch-next-broadcast" role="status">
              <strong>Next broadcast</strong>
              {channel.nextBroadcastAt && (
                <div className="ch-next-broadcast-time">
                  {new Date(channel.nextBroadcastAt).toLocaleString(undefined, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </div>
              )}
              {channel.nextBroadcastNote && (
                <SafePlainText
                  text={channel.nextBroadcastNote}
                  className="ch-next-broadcast-note"
                />
              )}
            </div>
          )}

          <ChannelTextLayerView
            mode={channel.textLayerMode}
            text={channel.textLayerText}
            align={channel.textLayerAlign}
          />

          <ChannelGalleryView mode={channel.galleryMode} images={channel.slideshowImages} />

          {hlsUrl && (
            <div className="ch-player-wrap">
              <div className="ch-player-inner">
                <HlsPlayer url={hlsUrl} />
              </div>
              <ReactionsOverlay slug={slug} />
            </div>
          )}

          <section className="ch-archive-section">
            <h2>Archive</h2>

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
                      {item.bannerUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.bannerUrl} alt="" className="ch-archive-banner" />
                      )}
                      {item.slideshowUrls && item.slideshowUrls.length > 0 && (
                        <div className="ch-archive-slideshow">
                          {item.slideshowUrls.map((url) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img key={url} src={url} alt="" />
                          ))}
                        </div>
                      )}
                      <div className="ch-archive-item-title">{item.title}</div>
                      {item.description && (
                        <SafePlainText text={item.description} className="ch-archive-item-desc" />
                      )}
                      {item.commentary && (
                        <SafePlainText
                          text={item.commentary}
                          className="ch-archive-item-commentary"
                        />
                      )}
                      {item.durationSec != null && (
                        <div className="ch-archive-item-duration">
                          {Math.floor(item.durationSec / 60)}:
                          {String(item.durationSec % 60).padStart(2, '0')}
                        </div>
                      )}
                      {item.tracklist && item.tracklist.length > 0 && (
                        <TracklistView entries={item.tracklist} />
                      )}
                      {item.audioUrl && (
                        <audio
                          controls
                          src={item.audioUrl}
                          className="ch-archive-audio"
                          data-testid="channel-archive-player"
                        />
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
