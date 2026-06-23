// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cookies } from 'next/headers'
import { Pill } from '@tahti/ui'
import { optOutChannel, removeOptOut, resetRotation } from './actions'

interface NowPlaying {
  live: boolean
  channel: { slug: string; artistName: string } | null
}

interface EligibleChannel {
  channelId: string
  slug: string
  artistName: string
  lastFeaturedAt: string | null
}

interface HistoryItem {
  channelId: string
  slug: string
  artistName: string
  featuredAt: string
}

interface OptedOutChannel {
  channelId: string
  slug: string
  artistName: string
  username: string
  isLive: boolean
}

interface RadioAdminData {
  nowPlaying: NowPlaying
  eligible: EligibleChannel[]
  history: HistoryItem[]
  optedOut: OptedOutChannel[]
}

async function fetchRadioAdmin(): Promise<RadioAdminData> {
  const sessionCookie = cookies().get('tahti_session')
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const res = await fetch(`${apiUrl}/api/admin/radio`, {
    headers: { Cookie: `tahti_session=${sessionCookie?.value ?? ''}` },
    cache: 'no-store',
  })
  if (!res.ok)
    return { nowPlaying: { live: false, channel: null }, eligible: [], history: [], optedOut: [] }
  return (await res.json()) as RadioAdminData
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default async function AdminRadioPage() {
  const { nowPlaying, eligible, history, optedOut } = await fetchRadioAdmin()

  return (
    <>
      <h1 className="admin-section-title">Tahti Radio</h1>
      <p className="admin-stat-sub" style={{ marginBottom: '2rem' }}>
        Fair-rotation meta-stream — member channels, no editorial picks
      </p>

      {/* Now playing */}
      <div className="admin-card" style={{ marginBottom: '2rem' }}>
        <h2
          style={{
            margin: '0 0 0.75rem',
            fontSize: '0.8rem',
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            opacity: 0.6,
          }}
        >
          Now playing
        </h2>
        {nowPlaying.live && nowPlaying.channel ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <span className="signal-dot" aria-hidden />
            <strong>{nowPlaying.channel.artistName}</strong>
            <a
              href={`/c/${nowPlaying.channel.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: '0.8rem', opacity: 0.7 }}
            >
              /c/{nowPlaying.channel.slug} ↗
            </a>
          </div>
        ) : (
          <p style={{ margin: 0, opacity: 0.55 }}>
            Radio is offline — no eligible channels live right now.
          </p>
        )}
      </div>

      {/* Eligible live channels */}
      <h2 className="admin-section-title" style={{ marginBottom: '0.5rem' }}>
        Eligible channels
        <span className="admin-radio-count">{eligible.length}</span>
      </h2>
      {eligible.length === 0 ? (
        <p className="admin-stat-sub" style={{ marginBottom: '2rem' }}>
          No member channels are live right now.
        </p>
      ) : (
        <div className="admin-table-wrap" style={{ marginBottom: '2rem' }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Artist</th>
                <th>Channel</th>
                <th>Last featured</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {eligible.map((ch) => (
                <tr key={ch.channelId}>
                  <td>{ch.artistName}</td>
                  <td>
                    <a
                      href={`/c/${ch.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'inherit', opacity: 0.7 }}
                    >
                      /c/{ch.slug} ↗
                    </a>
                  </td>
                  <td style={{ opacity: 0.6, fontSize: '0.85rem' }}>
                    {ch.lastFeaturedAt ? fmt(ch.lastFeaturedAt) : 'Never'}
                  </td>
                  <td style={{ display: 'flex', gap: '0.5rem' }}>
                    <form
                      action={async () => {
                        'use server'
                        await resetRotation(ch.channelId)
                      }}
                    >
                      <button type="submit" className="admin-btn admin-btn--sm">
                        Move to front
                      </button>
                    </form>
                    <form
                      action={async () => {
                        'use server'
                        await optOutChannel(ch.channelId)
                      }}
                    >
                      <button type="submit" className="admin-btn admin-btn--danger admin-btn--sm">
                        Opt out
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Opted-out channels */}
      {optedOut.length > 0 && (
        <>
          <h2 className="admin-section-title" style={{ marginBottom: '0.5rem' }}>
            Opted out
            <span className="admin-radio-count admin-radio-count--warn">{optedOut.length}</span>
          </h2>
          <div className="admin-table-wrap" style={{ marginBottom: '2rem' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Artist</th>
                  <th>Channel</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {optedOut.map((ch) => (
                  <tr key={ch.channelId}>
                    <td>{ch.artistName}</td>
                    <td>
                      <a
                        href={`/c/${ch.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'inherit', opacity: 0.7 }}
                      >
                        /c/{ch.slug} ↗
                      </a>
                    </td>
                    <td>
                      {ch.isLive ? (
                        <Pill variant="live" />
                      ) : (
                        <span style={{ opacity: 0.5, fontSize: '0.85rem' }}>Offline</span>
                      )}
                    </td>
                    <td>
                      <form
                        action={async () => {
                          'use server'
                          await removeOptOut(ch.channelId)
                        }}
                      >
                        <button type="submit" className="admin-btn admin-btn--sm">
                          Re-enable
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Feature history */}
      <h2 className="admin-section-title" style={{ marginBottom: '0.5rem' }}>
        Feature history
      </h2>
      {history.length === 0 ? (
        <p className="admin-stat-sub">No history yet.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Artist</th>
                <th>Channel</th>
                <th>Featured at</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item, i) => (
                <tr key={`${item.channelId}-${i}`}>
                  <td>{item.artistName}</td>
                  <td>
                    <a
                      href={`/c/${item.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'inherit', opacity: 0.7 }}
                    >
                      /c/{item.slug} ↗
                    </a>
                  </td>
                  <td style={{ opacity: 0.6, fontSize: '0.85rem' }}>{fmt(item.featuredAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
