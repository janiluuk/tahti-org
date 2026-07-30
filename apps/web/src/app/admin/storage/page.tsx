// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cookies } from 'next/headers'
import Link from 'next/link'
import { brandTokens } from '@tahti/ui'
import { QuotaEditor } from './_quota-editor'

interface StorageUserRow {
  userId: string
  username: string
  displayName: string
  quotaBytes: number
  usedBytes: number
}

interface StorageOverview {
  totalQuotaBytes: number
  totalUsedBytes: number
  userCount: number
  users: StorageUserRow[]
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(0)} MB`
  return `${(bytes / 1024).toFixed(0)} KB`
}

async function boardGet<T>(path: string): Promise<T | null> {
  const sessionCookie = cookies().get('tahti_session')
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const res = await fetch(`${apiUrl}${path}`, {
    headers: { Cookie: `tahti_session=${sessionCookie?.value ?? ''}` },
    cache: 'no-store',
  })
  if (!res.ok) return null
  return (await res.json()) as T
}

export default async function AdminStoragePage() {
  const overview = await boardGet<StorageOverview>('/api/admin/storage')

  return (
    <>
      <h1 className="admin-section-title">Storage</h1>
      <p className="admin-stat-sub" style={{ marginBottom: '1rem' }}>
        R2 long-term storage usage, tracked against each user&apos;s quota (500MB free tier
        default).
      </p>

      {!overview ? (
        <p className="admin-stat-sub">Could not load storage usage.</p>
      ) : (
        <>
          <div
            style={{
              display: 'flex',
              gap: '2rem',
              marginBottom: '1.5rem',
              padding: '1rem',
              border: '1px solid var(--admin-border, #333)',
              borderRadius: '8px',
            }}
          >
            <div>
              <div className="admin-stat-sub">Total used</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 600 }}>
                {formatBytes(overview.totalUsedBytes)}
              </div>
            </div>
            <div>
              <div className="admin-stat-sub">Total quota</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 600 }}>
                {formatBytes(overview.totalQuotaBytes)}
              </div>
            </div>
            <div>
              <div className="admin-stat-sub">Users with usage</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 600 }}>{overview.userCount}</div>
            </div>
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Used</th>
                  <th>Quota</th>
                  <th>%</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {overview.users.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ opacity: 0.55 }}>
                      No usage recorded yet.
                    </td>
                  </tr>
                ) : (
                  overview.users.map((row) => {
                    const pct = row.quotaBytes > 0 ? (row.usedBytes / row.quotaBytes) * 100 : 0
                    return (
                      <tr key={row.userId}>
                        <td>
                          {row.displayName} <span style={{ opacity: 0.55 }}>@{row.username}</span>
                        </td>
                        <td>{formatBytes(row.usedBytes)}</td>
                        <td style={{ opacity: 0.6 }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            <span>{formatBytes(row.quotaBytes)}</span>
                            <QuotaEditor userId={row.userId} quotaBytes={row.quotaBytes} />
                          </div>
                        </td>
                        <td
                          style={{
                            opacity: pct > 100 ? 1 : 0.6,
                            color: pct > 100 ? brandTokens.color.semantic.danger : undefined,
                          }}
                        >
                          {Math.round(pct)}%
                        </td>
                        <td>
                          <Link
                            href={`/admin/storage/${row.userId}`}
                            className="admin-btn admin-btn--sm"
                          >
                            Browse files
                          </Link>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  )
}
