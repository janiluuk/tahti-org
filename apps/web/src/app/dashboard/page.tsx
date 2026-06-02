// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.fi>

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import UploadForm from './upload-form.js'
import StreamSettingsPanel from './stream-settings.js'

interface StreamSettings {
  rtmp: { server: string; streamKey: string }
  icecast: { server: string; mount: string; password: string }
  hlsUrl: string
}

interface MeResponse {
  id: string
  email: string
  username: string
  displayName: string
  tier: string
  emailVerifiedAt: string | null
  membership: { status: string; activatedAt: string | null } | null
  channel: { slug: string; state: string } | null
}

interface ArchiveItem {
  id: string
  title: string
  description: string | null
  durationSec: number | null
  audioUrl: string | null
  createdAt: string
}

export default async function DashboardPage() {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get('tahti_session')

  if (!sessionCookie) {
    redirect('/login')
  }

  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'

  let user: MeResponse
  try {
    const response = await fetch(`${apiUrl}/api/auth/me`, {
      headers: { Cookie: `tahti_session=${sessionCookie.value}` },
      cache: 'no-store',
    })
    if (!response.ok) {
      redirect('/login')
    }
    user = (await response.json()) as MeResponse
  } catch {
    redirect('/login')
  }

  let streamSettings: StreamSettings | null = null
  if (user.channel) {
    try {
      const res = await fetch(`${apiUrl}/api/me/stream-settings`, {
        headers: { Cookie: `tahti_session=${sessionCookie.value}` },
        cache: 'no-store',
      })
      if (res.ok) {
        streamSettings = (await res.json()) as StreamSettings
      }
    } catch {
      // ignore
    }
  }

  let archiveItems: ArchiveItem[] = []
  if (user.channel) {
    try {
      const res = await fetch(`${apiUrl}/api/channels/${user.channel.slug}/items`, {
        cache: 'no-store',
      })
      if (res.ok) {
        archiveItems = (await res.json()) as ArchiveItem[]
      }
    } catch {
      // ignore — items section just shows empty
    }
  }

  return (
    <div style={{ maxWidth: 960, margin: '2rem auto', padding: '0 1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>Dashboard</h1>
        <form action="/api/auth/logout" method="POST">
          <button
            type="submit"
            style={{
              background: 'none',
              border: '1px solid #ccc',
              borderRadius: 4,
              padding: '0.4rem 0.8rem',
              cursor: 'pointer',
            }}
          >
            Log out
          </button>
        </form>
      </div>

      <p style={{ color: '#555', marginTop: '0.5rem' }}>Welcome back, {user.displayName}</p>

      {user.channel && (
        <section
          style={{
            marginTop: '2rem',
            padding: '1.5rem',
            border: '1px solid #eee',
            borderRadius: 8,
          }}
        >
          <h2 style={{ margin: '0 0 1rem' }}>Your channel</h2>
          <p style={{ margin: '0.25rem 0' }}>
            <strong>URL:</strong>{' '}
            <a href={`/c/${user.channel.slug}`}>
              <code>{user.channel.slug}.tahti.fi</code>
            </a>
          </p>
          <p style={{ margin: '0.25rem 0' }}>
            <strong>Status:</strong>{' '}
            <span style={{ color: user.channel.state === 'LIVE' ? '#16a34a' : '#888' }}>
              {user.channel.state === 'LIVE' ? 'Live' : 'Offline'}
            </span>
          </p>
        </section>
      )}

      {user.channel && streamSettings && (
        <StreamSettingsPanel initial={streamSettings} />
      )}

      {user.channel && (
        <section
          style={{
            marginTop: '2rem',
            padding: '1.5rem',
            border: '1px solid #eee',
            borderRadius: 8,
          }}
        >
          <h2 style={{ margin: '0 0 1rem' }}>Archive</h2>

          <UploadForm />

          {archiveItems.length === 0 ? (
            <p style={{ color: '#999', marginTop: '1.5rem' }}>No archive items yet.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, marginTop: '1.5rem' }}>
              {archiveItems.map((item) => (
                <li
                  key={item.id}
                  style={{
                    padding: '0.75rem 0',
                    borderBottom: '1px solid #f0f0f0',
                  }}
                >
                  <div style={{ fontWeight: 500 }}>{item.title}</div>
                  {item.durationSec != null && (
                    <div style={{ fontSize: '0.85rem', color: '#666' }}>
                      {Math.floor(item.durationSec / 60)}:
                      {String(item.durationSec % 60).padStart(2, '0')}
                    </div>
                  )}
                  {item.audioUrl && (
                    <audio
                      controls
                      src={item.audioUrl}
                      style={{ marginTop: '0.5rem', width: '100%' }}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}
