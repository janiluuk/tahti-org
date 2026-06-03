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
import { Badge, Heading, PageShell, Row, Text } from '@/components/ui'

interface ChannelResponse {
  slug: string
  state: string
  hlsUrl: string | null
  galleryMode: ChannelGalleryMode
  slideshowImages: string[]
  textLayerMode: ChannelTextLayerMode
  textLayerText: string
  textLayerAlign: ChannelTextLayerAlignment
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

  return (
    <PageShell size="lg" style={{ marginTop: '2rem', marginBottom: '2rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '2rem' }}>
        <div>
          <header style={{ marginBottom: '1.5rem' }}>
            <Row className="ui-row--gap-3" style={{ marginBottom: '0.5rem' }}>
              {channel.user.avatarUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={channel.user.avatarUrl}
                  alt={channel.user.displayName}
                  width={64}
                  height={64}
                  style={{ borderRadius: '50%' }}
                />
              )}
              <div>
                <Heading level={1} style={{ marginBottom: '0.15rem' }}>
                  {channel.user.displayName}
                </Heading>
                <Text size="sm" tone="muted">
                  @{channel.user.username}
                </Text>
              </div>
              {channel.state === 'LIVE' && <Badge variant="live">Live</Badge>}
            </Row>
            {channel.user.bio && <Text tone="secondary">{channel.user.bio}</Text>}
          </header>

          <ChannelTextLayerView
            mode={channel.textLayerMode}
            text={channel.textLayerText}
            align={channel.textLayerAlign}
          />

          <ChannelGalleryView mode={channel.galleryMode} images={channel.slideshowImages} />

          {/* HLS player + reactions overlay (only when live) */}
          {hlsUrl && (
            <div
              style={{
                position: 'relative',
                background: '#111',
                borderRadius: 8,
                overflow: 'hidden',
                minHeight: 80,
              }}
            >
              <div style={{ padding: '0.75rem' }}>
                <HlsPlayer url={hlsUrl} />
              </div>
              <ReactionsOverlay slug={slug} />
            </div>
          )}

          <section style={{ marginTop: '2rem' }}>
            <h2 style={{ margin: '0 0 1rem' }}>Archive</h2>

            {items.length === 0 ? (
              <p style={{ color: '#999' }}>No archive items yet.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {items.map((item) => {
                  const { imageUrl, videoEmbedUrl } = resolveArchiveBackground(item.backgroundUrl)
                  return (
                    <li
                      key={item.id}
                      id={`archive-item-${item.id}`}
                      style={{
                        padding: '1rem 0',
                        borderBottom: '1px solid #eee',
                        ...(imageUrl
                          ? {
                              backgroundImage: `linear-gradient(rgba(255,255,255,0.92), rgba(255,255,255,0.92)), url(${imageUrl})`,
                              backgroundSize: 'cover',
                              backgroundPosition: 'center',
                            }
                          : {}),
                      }}
                    >
                      {videoEmbedUrl && <ArchiveVideoBackdrop embedUrl={videoEmbedUrl} />}
                      {item.bannerUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.bannerUrl}
                          alt=""
                          style={{
                            width: '100%',
                            maxHeight: 200,
                            objectFit: 'cover',
                            borderRadius: 8,
                            marginBottom: '0.75rem',
                          }}
                        />
                      )}
                      {item.slideshowUrls && item.slideshowUrls.length > 0 && (
                        <div
                          style={{
                            display: 'flex',
                            gap: '0.35rem',
                            overflowX: 'auto',
                            marginBottom: '0.75rem',
                          }}
                        >
                          {item.slideshowUrls.map((url) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              key={url}
                              src={url}
                              alt=""
                              style={{
                                height: 72,
                                width: 72,
                                objectFit: 'cover',
                                borderRadius: 4,
                                flexShrink: 0,
                              }}
                            />
                          ))}
                        </div>
                      )}
                      <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{item.title}</div>
                      {item.description && (
                        <p style={{ color: '#555', margin: '0 0 0.5rem', fontSize: '0.9rem' }}>
                          {item.description}
                        </p>
                      )}
                      {item.commentary && (
                        <div
                          style={{
                            color: '#444',
                            margin: '0 0 0.75rem',
                            fontSize: '0.9rem',
                            lineHeight: 1.5,
                            whiteSpace: 'pre-wrap',
                            borderLeft: '3px solid #ddd',
                            paddingLeft: '0.75rem',
                          }}
                        >
                          {item.commentary}
                        </div>
                      )}
                      {item.durationSec != null && (
                        <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '0.5rem' }}>
                          {Math.floor(item.durationSec / 60)}:
                          {String(item.durationSec % 60).padStart(2, '0')}
                        </div>
                      )}
                      {item.tracklist && item.tracklist.length > 0 && (
                        <TracklistView entries={item.tracklist} />
                      )}
                      {item.audioUrl && (
                        <audio controls src={item.audioUrl} style={{ width: '100%' }} />
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
        </div>

        {/* Chat panel — docked on the right */}
        <div>
          <ChatPanel slug={slug} announcements={announcements} />
          <FanChatPanel slug={slug} />
        </div>
      </div>
    </PageShell>
  )
}
