// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cookies } from 'next/headers'
import Link from 'next/link'

interface AdminUserFile {
  id: string
  kind: 'sound' | 'stash'
  title: string
  sizeBytes: number | null
  createdAt: string
  contentType: string | null
  isPublic: boolean | null
  isAudio: boolean
  previewUrl: string | null
  runningTotalBytes: number
}

interface AdminUserFilesResponse {
  userId: string
  username: string
  displayName: string
  tier: 'FREE' | 'ARTIST' | 'STUDIO'
  quotaBytes: number | null
  usedBytes: number
  unlimited: boolean
  files: AdminUserFile[]
}

function formatBytes(bytes: number | null): string {
  if (bytes == null) return '—'
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(0)} MB`
  return `${(bytes / 1024).toFixed(0)} KB`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
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

export default async function AdminUserStoragePage({ params }: { params: { userId: string } }) {
  const data = await boardGet<AdminUserFilesResponse>(
    `/api/admin/storage/users/${params.userId}/files`,
  )

  return (
    <>
      <p style={{ marginBottom: '0.5rem' }}>
        <Link href="/admin/storage" className="admin-btn admin-btn--sm">
          ← All storage
        </Link>
      </p>
      <h1 className="admin-section-title">{data ? `${data.displayName} — files` : 'Files'}</h1>
      {data && (
        <p className="admin-stat-sub" style={{ marginBottom: '1rem' }}>
          @{data.username} · {data.tier.toLowerCase()} tier ·{' '}
          {data.unlimited
            ? `${formatBytes(data.usedBytes)} used (unlimited — member)`
            : `${formatBytes(data.usedBytes)} of ${formatBytes(data.quotaBytes)} used`}
        </p>
      )}

      {!data ? (
        <p className="admin-stat-sub">Could not load this user&apos;s files.</p>
      ) : data.files.length === 0 ? (
        <p className="admin-stat-sub">No files yet.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>File</th>
                <th>Type</th>
                <th>Uploaded</th>
                <th>Size</th>
                <th>Running total</th>
                <th>Preview</th>
              </tr>
            </thead>
            <tbody>
              {data.files.map((file) => (
                <tr key={file.id}>
                  <td>{file.title}</td>
                  <td style={{ opacity: 0.7 }}>
                    {file.kind === 'sound' ? (file.contentType ?? 'sound') : 'stash'}
                  </td>
                  <td style={{ opacity: 0.6 }}>{formatDate(file.createdAt)}</td>
                  <td style={{ opacity: 0.6 }}>{formatBytes(file.sizeBytes)}</td>
                  <td style={{ opacity: 0.6 }}>{formatBytes(file.runningTotalBytes)}</td>
                  <td>
                    {file.isAudio && file.previewUrl ? (
                      // eslint-disable-next-line jsx-a11y/media-has-caption
                      <audio src={file.previewUrl} controls style={{ height: '28px' }} />
                    ) : (
                      <span style={{ opacity: 0.4 }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
