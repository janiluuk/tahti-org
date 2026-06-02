// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.fi>

import { notFound } from 'next/navigation'
import ChatPanel from './chat-panel.js'

interface ChannelResponse {
  slug: string
  state: string
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
  durationSec: number | null
  audioUrl: string | null
  createdAt: string
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

  const hlsUrl = channel.state === 'LIVE'
    ? `${process.env.HLS_BASE_URL ?? 'http://localhost:9000/hls-live'}/${slug}/stream.m3u8`
    : null

  return (
    <div style={{ maxWidth: 1100, margin: '2rem auto', padding: '0 1rem' }}>
      {/* Two-column layout: player + archive on left, chat on right */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '2rem' }}>
        <div>
          <header style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
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
                <h1 style={{ margin: '0 0 0.15rem' }}>{channel.user.displayName}</h1>
                <p style={{ color: '#888', margin: 0, fontSize: '0.9rem' }}>
                  @{channel.user.username}
                </p>
              </div>
              {channel.state === 'LIVE' && (
                <span
                  style={{
                    display: 'inline-block',
                    background: '#dc2626',
                    color: '#fff',
                    padding: '0.25rem 0.7rem',
                    borderRadius: 4,
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                  }}
                >
                  LIVE
                </span>
              )}
            </div>
            {channel.user.bio && <p style={{ color: '#555', margin: 0 }}>{channel.user.bio}</p>}
          </header>

          {/* HLS player (only when live) */}
          {hlsUrl && (
            <HlsPlayer url={hlsUrl} />
          )}

          <section style={{ marginTop: '2rem' }}>
            <h2 style={{ margin: '0 0 1rem' }}>Archive</h2>

            {items.length === 0 ? (
              <p style={{ color: '#999' }}>No archive items yet.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {items.map((item) => (
                  <li
                    key={item.id}
                    style={{ padding: '1rem 0', borderBottom: '1px solid #eee' }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{item.title}</div>
                    {item.description && (
                      <p style={{ color: '#555', margin: '0 0 0.5rem', fontSize: '0.9rem' }}>
                        {item.description}
                      </p>
                    )}
                    {item.durationSec != null && (
                      <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '0.5rem' }}>
                        {Math.floor(item.durationSec / 60)}:
                        {String(item.durationSec % 60).padStart(2, '0')}
                      </div>
                    )}
                    {item.audioUrl && (
                      <audio controls src={item.audioUrl} style={{ width: '100%' }} />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Chat panel — docked on the right */}
        <ChatPanel slug={slug} announcements={announcements} />
      </div>
    </div>
  )
}

// Inline RSC wrapper that renders a placeholder; HLS playback is client-side
function HlsPlayer({ url }: { url: string }) {
  return (
    <div
      style={{
        background: '#111',
        borderRadius: 8,
        padding: '1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 80,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <noscript>
        <p style={{ color: '#ccc' }}>Enable JavaScript to play the live stream.</p>
      </noscript>
      {/* HlsPlayerClient is loaded client-side and hydrates this */}
      <HlsPlayerClient url={url} />
    </div>
  )
}

// This is a server component; we use a dynamic import trick via the chat-panel pattern.
// For now render a simple <audio> with HLS.js loaded via CDN script in layout.
function HlsPlayerClient({ url }: { url: string }) {
  return (
    // The audio element with data-hls-src is picked up by a small inline script
    // that initialises Hls.js. See layout.tsx for the CDN script tag.
    <audio
      id="hls-player"
      controls
      data-hls-src={url}
      style={{ width: '100%' }}
    />
  )
}
