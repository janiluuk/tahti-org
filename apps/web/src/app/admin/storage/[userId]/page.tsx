// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cookies } from 'next/headers'
import Link from 'next/link'

interface AdminUserFile {
  trackId: string
  title: string
  releaseTitle: string
  durationSec: number | null
  inR2: boolean
  sizeBytes: number | null
  previewUrl: string | null
}

interface AdminUserFilesResponse {
  username: string
  displayName: string
  files: AdminUserFile[]
}

function formatBytes(bytes: number | null): string {
  if (bytes == null) return '—'
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(0)} MB`
  return `${(bytes / 1024).toFixed(0)} KB`
}

function formatDuration(sec: number | null): string {
  if (sec == null) return '—'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
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
          @{data.username} · release tracks only (the only content type on R2 so far)
        </p>
      )}

      {!data ? (
        <p className="admin-stat-sub">Could not load this user&apos;s files.</p>
      ) : data.files.length === 0 ? (
        <p className="admin-stat-sub">No release tracks yet.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Track</th>
                <th>Release</th>
                <th>Duration</th>
                <th>R2</th>
                <th>Size</th>
                <th>Preview</th>
              </tr>
            </thead>
            <tbody>
              {data.files.map((file) => (
                <tr key={file.trackId}>
                  <td>{file.title}</td>
                  <td style={{ opacity: 0.7 }}>{file.releaseTitle}</td>
                  <td style={{ opacity: 0.6 }}>{formatDuration(file.durationSec)}</td>
                  <td style={{ opacity: file.inR2 ? 1 : 0.4 }}>
                    {file.inR2 ? 'Mirrored' : 'Local only'}
                  </td>
                  <td style={{ opacity: 0.6 }}>{formatBytes(file.sizeBytes)}</td>
                  <td>
                    {file.previewUrl ? (
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
