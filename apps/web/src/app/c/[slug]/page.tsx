// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.fi>

import { notFound } from 'next/navigation'

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

  const itemsRes = await fetch(`${apiUrl}/api/channels/${slug}/items`, { cache: 'no-store' })
  const items: ArchiveItem[] = itemsRes.ok ? ((await itemsRes.json()) as ArchiveItem[]) : []

  return (
    <div style={{ maxWidth: 800, margin: '2rem auto', padding: '0 1rem' }}>
      <header style={{ marginBottom: '2rem' }}>
        {channel.user.avatarUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={channel.user.avatarUrl}
            alt={channel.user.displayName}
            width={80}
            height={80}
            style={{ borderRadius: '50%', marginBottom: '0.75rem' }}
          />
        )}
        <h1 style={{ margin: '0 0 0.25rem' }}>{channel.user.displayName}</h1>
        <p style={{ color: '#888', margin: '0 0 0.5rem', fontSize: '0.9rem' }}>
          @{channel.user.username}
        </p>
        {channel.user.bio && <p style={{ color: '#555' }}>{channel.user.bio}</p>}
        {channel.state === 'LIVE' && (
          <span
            style={{
              display: 'inline-block',
              background: '#dc2626',
              color: '#fff',
              padding: '0.2rem 0.6rem',
              borderRadius: 4,
              fontSize: '0.8rem',
              fontWeight: 600,
            }}
          >
            LIVE
          </span>
        )}
      </header>

      <section>
        <h2 style={{ margin: '0 0 1rem' }}>Archive</h2>

        {items.length === 0 ? (
          <p style={{ color: '#999' }}>No archive items yet.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {items.map((item) => (
              <li
                key={item.id}
                style={{
                  padding: '1rem 0',
                  borderBottom: '1px solid #eee',
                }}
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
                {item.audioUrl && <audio controls src={item.audioUrl} style={{ width: '100%' }} />}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
