// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cookies } from 'next/headers'
import { addToRotation, removeFromRotation, reorderItem } from './actions'

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
    q ? adminGet<{ items: BrowseItem[] }>(`/api/admin/tahti-selects/browse?q=${encodeURIComponent(q)}`) : null,
  ])
  const items = rotation?.items ?? []
  const browseItems = browse?.items ?? []
  const inRotationIds = new Set(items.map((i) => i.archiveItemId))

  return (
    <>
      <h1 className="admin-section-title">Tahti Selects</h1>
      <p className="admin-stat-sub" style={{ marginBottom: '2rem' }}>
        Always-on curated rotation — loops the list below endlessly. Only public archive items can
        be added.
      </p>

      <h2 className="admin-section-title" style={{ marginBottom: '0.5rem' }}>
        Current rotation
        <span className="admin-radio-count">{items.length}</span>
      </h2>
      {items.length === 0 ? (
        <p className="admin-stat-sub" style={{ marginBottom: '2rem' }}>
          Nothing in rotation yet — add tracks below.
        </p>
      ) : (
        <div className="admin-table-wrap" style={{ marginBottom: '2rem' }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Title</th>
                <th>Artist</th>
                <th>Duration</th>
                <th>License</th>
                <th>Added by</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={item.id}>
                  <td style={{ opacity: 0.6, fontSize: '0.85rem' }}>{index + 1}</td>
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
                  <td style={{ opacity: 0.6, fontSize: '0.85rem' }}>{fmtLicense(item.license)}</td>
                  <td style={{ opacity: 0.6, fontSize: '0.85rem' }}>{item.addedBy}</td>
                  <td style={{ display: 'flex', gap: '0.4rem' }}>
                    <form
                      action={async () => {
                        'use server'
                        if (index > 0) await reorderItem(item.id, index - 1)
                      }}
                    >
                      <button
                        type="submit"
                        className="admin-btn admin-btn--sm"
                        disabled={index === 0}
                      >
                        ↑
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
                        className="admin-btn admin-btn--sm"
                        disabled={index === items.length - 1}
                      >
                        ↓
                      </button>
                    </form>
                    <form
                      action={async () => {
                        'use server'
                        await removeFromRotation(item.id)
                      }}
                    >
                      <button type="submit" className="admin-btn admin-btn--danger admin-btn--sm">
                        Remove
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
