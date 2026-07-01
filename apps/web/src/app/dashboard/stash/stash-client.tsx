// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useRef } from 'react'
import { SidebarNavIconSvg, Button } from '@tahti/ui'

interface StashShare {
  id: string
  granteeUsername: string | null
  token: string
  permission: string
  fileCount: number
  expiresAt: string | null
  createdAt: string
}

interface StashFile {
  id: string
  filename: string
  contentType: string
  sizeBytes: string
  format: string | null
  bitDepth: number | null
  sampleRate: number | null
  createdAt: string
  updatedAt: string
  shareCount: number
  shares: StashShare[]
}

function fmtSize(bytes: number): string {
  if (bytes < 1_000_000) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1_000_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`
  return `${(bytes / 1_000_000_000).toFixed(2)} GB`
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffH = Math.floor(diffMs / 3_600_000)
  if (diffH < 1) return 'Just now'
  if (diffH < 24) return `${diffH}h ago`
  if (diffH < 48) return 'Yesterday'
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function fileLabel(f: StashFile): string {
  const parts: string[] = []
  if (f.format) parts.push(f.format)
  if (f.bitDepth && f.sampleRate) parts.push(`${f.bitDepth}-bit/${f.sampleRate / 1000}kHz`)
  parts.push(fmtSize(Number(f.sizeBytes)))
  return parts.join(' · ')
}

const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001'

async function apiFetch(path: string, opts?: RequestInit) {
  return fetch(`${apiBase}${path}`, { credentials: 'include', ...opts })
}

export function StashClient({ initialFiles }: { initialFiles: StashFile[] }) {
  const [files, setFiles] = useState<StashFile[]>(initialFiles)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [sharingFileId, setSharingFileId] = useState<string | null>(null)
  const [shareExpiryDays, setShareExpiryDays] = useState(7)
  const [shareGrantee, setShareGrantee] = useState('')
  const [sharePermission, setSharePermission] = useState<'READ' | 'DOWNLOAD'>('DOWNLOAD')
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadProgress(0)

    try {
      const prepRes = await apiFetch('/api/me/stash/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
        }),
      })
      if (!prepRes.ok) throw new Error('Prepare failed')
      const { objectKey, uploadUrl } = (await prepRes.json()) as {
        objectKey: string
        uploadUrl: string
      }

      await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
      })
      setUploadProgress(80)

      const ext = file.name.split('.').pop()?.toUpperCase() ?? ''
      const formatMap: Record<string, string> = {
        FLAC: 'FLAC',
        WAV: 'WAV',
        MP3: 'MP3',
        ZIP: 'ZIP',
        AIFF: 'AIFF',
      }

      const registerRes = await apiFetch('/api/me/stash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          objectKey,
          filename: file.name,
          contentType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
          format: formatMap[ext] ?? ext,
        }),
      })
      if (!registerRes.ok) throw new Error('Register failed')

      setUploadProgress(100)

      const listRes = await apiFetch('/api/me/stash')
      if (listRes.ok) setFiles((await listRes.json()) as StashFile[])
    } catch (err) {
      alert(`Upload failed: ${String(err)}`)
    } finally {
      setUploading(false)
      setUploadProgress(0)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleDownload(fileId: string, filename: string) {
    const res = await apiFetch(`/api/me/stash/${fileId}/download`)
    if (!res.ok) return alert('Download failed')
    const { url } = (await res.json()) as { url: string }
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
  }

  async function handleDelete(fileId: string) {
    if (!confirm('Delete this file from your stash?')) return
    const res = await apiFetch(`/api/me/stash/${fileId}`, { method: 'DELETE' })
    if (!res.ok) return alert('Delete failed')
    setFiles((prev) => prev.filter((f) => f.id !== fileId))
  }

  async function handleCreateShare(fileId: string) {
    const body: Record<string, unknown> = {
      permission: sharePermission,
    }
    if (shareGrantee.trim()) body.granteeUsername = shareGrantee.trim().replace('@', '')
    if (shareExpiryDays > 0) body.expiresInDays = shareExpiryDays

    const res = await apiFetch(`/api/me/stash/${fileId}/share`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) return alert('Share creation failed')

    const listRes = await apiFetch('/api/me/stash')
    if (listRes.ok) setFiles((await listRes.json()) as StashFile[])
    setSharingFileId(null)
    setShareGrantee('')
  }

  async function handleRevokeShare(shareId: string) {
    if (!confirm('Revoke this share? They will lose access immediately.')) return
    const res = await apiFetch(`/api/me/stash/shares/${shareId}`, { method: 'DELETE' })
    if (!res.ok) return alert('Revoke failed')
    const listRes = await apiFetch('/api/me/stash')
    if (listRes.ok) setFiles((await listRes.json()) as StashFile[])
  }

  const allShares = files.flatMap((f) => f.shares.map((s) => ({ ...s, filename: f.filename })))

  return (
    <div className="stash-wrap">
      <div className="stash-actions">
        <input
          ref={fileInputRef}
          type="file"
          className="stash-file-input"
          aria-label="Upload file to stash"
          onChange={handleUpload}
          disabled={uploading}
        />
        <Button
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          variant="primary"
          className="stash-upload-btn"
        >
          <SidebarNavIconSvg name="upload" />
          {uploading ? `Uploading… ${uploadProgress}%` : 'Upload file'}
        </Button>
      </div>

      {uploading && (
        <div className="stash-progress-wrap">
          <div className="stash-progress-fill" style={{ width: `${uploadProgress}%` }} />
        </div>
      )}

      <div className="stash-section">
        <span className="db-section-label">WIP Tracks</span>

        {files.length === 0 ? (
          <div className="studio-empty-card studio-mb-0">
            <p className="studio-empty-card__text">No files yet</p>
            <p className="studio-empty-card__hint">
              Upload WIPs, stems, and mixes here — private until you share a link.
            </p>
          </div>
        ) : (
          <ul className="stash-file-list">
            {files.map((f) => (
              <li key={f.id} className="stash-file-row">
                <span className="stash-file-lock" aria-label="Private" title="Private">
                  🔒
                </span>
                <div className="stash-file-info">
                  <span className="stash-file-name">{f.filename}</span>
                  <span className="stash-file-meta">
                    {fileLabel(f)} · Modified {fmtDate(f.updatedAt)} ·{' '}
                    {f.shareCount > 0
                      ? `${f.shareCount} share${f.shareCount > 1 ? 's' : ''}`
                      : 'Not shared'}
                  </span>
                </div>
                <div className="stash-file-actions">
                  <button
                    type="button"
                    className="stash-btn stash-btn--share"
                    onClick={() => setSharingFileId(sharingFileId === f.id ? null : f.id)}
                  >
                    Share link
                  </button>
                  <button
                    type="button"
                    className="stash-btn"
                    onClick={() => void handleDownload(f.id, f.filename)}
                    aria-label="Download"
                    title="Download"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="stash-btn stash-btn--danger"
                    onClick={() => void handleDelete(f.id)}
                    aria-label="Delete"
                    title="Delete"
                  >
                    ✕
                  </button>
                </div>

                {sharingFileId === f.id && (
                  <div className="stash-share-form">
                    <input
                      type="text"
                      className="stash-share-input"
                      placeholder="@username (optional)"
                      value={shareGrantee}
                      onChange={(e) => setShareGrantee(e.target.value)}
                    />
                    <select
                      className="stash-share-select"
                      value={sharePermission}
                      onChange={(e) => setSharePermission(e.target.value as 'READ' | 'DOWNLOAD')}
                    >
                      <option value="READ">Read-only</option>
                      <option value="DOWNLOAD">Download</option>
                    </select>
                    <select
                      className="stash-share-select"
                      value={shareExpiryDays}
                      onChange={(e) => setShareExpiryDays(Number(e.target.value))}
                    >
                      <option value={1}>1 day</option>
                      <option value={3}>3 days</option>
                      <option value={7}>7 days</option>
                      <option value={30}>30 days</option>
                      <option value={0}>Permanent</option>
                    </select>
                    <button
                      type="button"
                      className="stash-btn stash-btn--primary"
                      onClick={() => void handleCreateShare(f.id)}
                    >
                      Create link
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {allShares.length > 0 && (
        <div className="stash-section">
          <span className="db-section-label">Shared Access</span>
          <ul className="stash-share-list">
            {allShares.map((s) => {
              const expired = s.expiresAt ? new Date(s.expiresAt) < new Date() : false
              const daysLeft = s.expiresAt
                ? Math.max(0, Math.ceil((new Date(s.expiresAt).getTime() - Date.now()) / 86400_000))
                : null
              return (
                <li
                  key={s.id}
                  className={`stash-share-row${expired ? ' stash-share-row--expired' : ''}`}
                >
                  <div className="stash-share-avatar">
                    {s.granteeUsername ? s.granteeUsername.slice(0, 2).toUpperCase() : '?'}
                  </div>
                  <div className="stash-share-info">
                    <span className="stash-share-grantee">
                      {s.granteeUsername ? `@${s.granteeUsername}` : 'Link share'}
                    </span>
                    <span className="stash-share-meta">
                      {s.permission === 'DOWNLOAD' ? 'Download' : 'Read-only'} · {s.filename}
                      {daysLeft !== null
                        ? ` · Link expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`
                        : ' · Permanent link'}
                      {expired && ' · Expired'}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="stash-btn stash-btn--revoke"
                    onClick={() => void handleRevokeShare(s.id)}
                  >
                    Revoke
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
