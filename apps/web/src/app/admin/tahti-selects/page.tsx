// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cookies } from 'next/headers'
import {
  addToRotation,
  removeFromRotation,
  reorderItem,
  startRotationStream,
  stopRotationStream,
} from './actions'

interface RotationItem {
  id: string
  position: number
  addedBy: string
  archiveItemId: string
  title: string
  durationSec: number | null
  license: string
  artistName: string
  channelSlug: string
}

interface BrowseItem {
  id: string
  title: string
  durationSec: number | null
  license: string
  artistName: string
  channelSlug: string
}

async function adminGet<T>(path: string): Promise<T | null> {
  const sessionCookie = cookies().get('tahti_session')
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const res = await fetch(`${apiUrl}${path}`, {
    headers: { Cookie: `tahti_session=${sessionCookie?.value ?? ''}` },
    cache: 'no-store',
  })
  if (!res.ok) return null
  return (await res.json()) as T
}

function fmtDuration(sec: number | null) {
  if (!sec) return '—'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function fmtLicense(license: string) {
  return license.replace(/_/g, ' ')
}

export default async function AdminTahtiSelectsPage({
  searchParams,
}: {
  searchParams: { q?: string }
}) {
  const q = searchParams.q?.trim() ?? ''
  const [rotation, browse] = await Promise.all([
    adminGet<{ items: RotationItem[] }>('/api/admin/tahti-selects'),
    q
      ? adminGet<{ items: BrowseItem[] }>(
          `/api/admin/tahti-selects/browse?q=${encodeURIComponent(q)}`,
        )
      : null,
  ])
  const items = rotation?.items ?? []
  const browseItems = browse?.items ?? []
  const inRotationIds = new Set(items.map((i) => i.archiveItemId))

  return (
    <>
      <h1 className="admin-section-title">Tahti Selects</h1>
      <p className="admin-stat-sub" style={{ marginBottom: '1rem' }}>
        Always-on curated rotation — loops the list below endlessly. Only public archive items can
        be added.
      </p>

      <div
        style={{
          marginBottom: '2rem',
          padding: '1rem',
          border: '1px solid var(--admin-border, #333)',
          borderRadius: '8px',
        }}
      >
        <p className="admin-stat-sub" style={{ marginBottom: '0.75rem' }}>
          The rotation above is just playlist content — starting the stream spawns the actual
          always-on Liquidsoap container that turns it into audio. Once running, point Tahti
          Radio&apos;s <code>TAHTI_RADIO_AUDIO_URL</code> env var at its public HLS output
          (typically <code>https://stream.tahti.live/tahti-selects/stream.m3u8</code>) so the /radio
          page plays it 24/7 instead of the default placeholder video.
        </p>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <form
            action={async () => {
              'use server'
              await startRotationStream()
            }}
          >
            <button type="submit" className="admin-btn admin-btn--sm">
              Start stream
            </button>
          </form>
          <form
            action={async () => {
              'use server'
              await stopRotationStream()
            }}
          >
            <button type="submit" className="admin-btn admin-btn--danger admin-btn--sm">
              Stop stream
            </button>
          </form>
        </div>
      </div>

      <h2 className="admin-section-title" style={{ marginBottom: '0.5rem' }}>
        Current rotation
        <span className="admin-radio-count">{items.length}</span>
      </h2>
      {items.length === 0 ? (
        <p className="admin-stat-sub" style={{ marginBottom: '2rem' }}>
          Nothing in rotation yet — add tracks below.
        </p>
      ) : (
        <div className="admin-rotation-list" style={{ marginBottom: '2rem' }}>
          {items.map((item, index) => (
            <div key={item.id} className="admin-rotation-row">
              <span className="admin-rotation-row__index">{index + 1}</span>
              <span className="admin-rotation-row__art" aria-hidden>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M6 12.5a1.75 1.75 0 1 1 0-3.5 1.75 1.75 0 0 1 0 3.5Z"
                    stroke="currentColor"
                    strokeWidth="1.3"
                  />
                  <path d="M7.75 11V3.5L13 2.5v7" stroke="currentColor" strokeWidth="1.3" />
                </svg>
              </span>
              <span className="admin-rotation-row__body">
                <span className="admin-rotation-row__title">{item.title}</span>
                <span className="admin-rotation-row__meta">
                  <a href={`/c/${item.channelSlug}`} target="_blank" rel="noopener noreferrer">
                    {item.artistName} ↗
                  </a>
                  {' · '}
                  {fmtDuration(item.durationSec)} · {fmtLicense(item.license)} · added by{' '}
                  {item.addedBy}
                </span>
              </span>
              <span className="admin-rotation-row__actions">
                <form
                  action={async () => {
                    'use server'
                    if (index > 0) await reorderItem(item.id, index - 1)
                  }}
                >
                  <button
                    type="submit"
                    className="admin-rotation-row__move"
                    disabled={index === 0}
                    aria-label={`Move "${item.title}" up`}
                    title="Move up"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                      <path
                        d="M8 12V4M4 8l4-4 4 4"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </form>
                <form
                  action={async () => {
                    'use server'
                    if (index < items.length - 1) await reorderItem(item.id, index + 1)
                  }}
                >
                  <button
                    type="submit"
                    className="admin-rotation-row__move"
                    disabled={index === items.length - 1}
                    aria-label={`Move "${item.title}" down`}
                    title="Move down"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                      <path
                        d="M8 4v8m4-4-4 4-4-4"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </form>
                <form
                  action={async () => {
                    'use server'
                    await removeFromRotation(item.id)
                  }}
                >
                  <button
                    type="submit"
                    className="admin-rotation-row__remove"
                    aria-label={`Remove "${item.title}" from rotation`}
                    title="Remove from rotation"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                      <path
                        d="M3 4.5h10M6.5 4.5V3a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1.5M6 7.5v4M10 7.5v4M4 4.5l.6 8.1a1 1 0 0 0 1 .9h4.8a1 1 0 0 0 1-.9l.6-8.1"
                        stroke="currentColor"
                        strokeWidth="1.3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </form>
              </span>
            </div>
          ))}
        </div>
      )}

      <h2 className="admin-section-title" style={{ marginBottom: '0.5rem' }}>
        Add from artist archives
      </h2>
      <form method="GET" style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem' }}>
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search public archive items by title…"
          className="admin-search-input"
          style={{ flex: 1, maxWidth: '360px' }}
        />
        <button type="submit" className="admin-btn admin-btn--sm">
          Search
        </button>
      </form>

      {q && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Artist</th>
                <th>Duration</th>
                <th>License</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {browseItems.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ opacity: 0.55 }}>
                    No public archive items match &ldquo;{q}&rdquo;.
                  </td>
                </tr>
              ) : (
                browseItems.map((item) => {
                  const already = inRotationIds.has(item.id)
                  return (
                    <tr key={item.id}>
                      <td>{item.title}</td>
                      <td>
                        <a
                          href={`/c/${item.channelSlug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: 'inherit', opacity: 0.7 }}
                        >
                          {item.artistName} ↗
                        </a>
                      </td>
                      <td style={{ opacity: 0.6, fontSize: '0.85rem' }}>
                        {fmtDuration(item.durationSec)}
                      </td>
                      <td style={{ opacity: 0.6, fontSize: '0.85rem' }}>
                        {fmtLicense(item.license)}
                      </td>
                      <td>
                        {already ? (
                          <span style={{ opacity: 0.5, fontSize: '0.85rem' }}>In rotation</span>
                        ) : (
                          <form
                            action={async () => {
                              'use server'
                              await addToRotation(item.id)
                            }}
                          >
                            <button type="submit" className="admin-btn admin-btn--sm">
                              Add
                            </button>
                          </form>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
