// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import type { ArchiveVersionRow } from '@tahti/shared'
import {
  activateArchiveVersion,
  completeArchiveVersionUpload,
  fetchArchiveVersions,
  prepareArchiveVersionUpload,
} from './archive-actions'

export function ArchiveVersionPanel({
  itemId,
  itemStatus,
}: {
  itemId: string
  itemStatus: string
}) {
  const [versions, setVersions] = useState<ArchiveVersionRow[]>([])
  const [versionLabel, setVersionLabel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [isPending, startTransition] = useTransition()

  const load = useCallback(async () => {
    const res = await fetchArchiveVersions(itemId)
    if (res.error) setError(res.error)
    else if (res.versions) setVersions(res.versions)
    setLoading(false)
  }, [itemId])

  useEffect(() => {
    if (itemStatus === 'READY') void load()
    else setLoading(false)
  }, [itemStatus, load])

  async function handleUpload(file: File) {
    const label = versionLabel.trim()
    if (!label) {
      setError('Enter a version label (e.g. Re-edit, Remix)')
      return
    }
    setError(null)
    setUploading(true)
    try {
      const prep = await prepareArchiveVersionUpload(itemId, {
        filename: file.name,
        contentType: file.type || 'audio/mpeg',
      })
      if (prep.error || !prep.uploadUrl || !prep.uploadId) {
        setError(prep.error ?? 'Prepare failed')
        return
      }
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', prep.uploadUrl!)
        xhr.setRequestHeader('Content-Type', file.type || 'audio/mpeg')
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject())
        xhr.onerror = () => reject(new Error('Upload failed'))
        xhr.send(file)
      })
      const done = await completeArchiveVersionUpload(itemId, {
        uploadId: prep.uploadId!,
        versionLabel: label,
        fileSizeBytes: file.size,
      })
      if (done.error) {
        setError(done.error)
        return
      }
      setVersionLabel('')
      await load()
    } catch {
      setError('Upload failed')
    } finally {
      setUploading(false)
    }
  }

  function activate(versionId: string) {
    setError(null)
    startTransition(async () => {
      const res = await activateArchiveVersion(itemId, versionId)
      if (res.error) setError(res.error)
      else if (res.versions) setVersions(res.versions)
    })
  }

  if (itemStatus !== 'READY') return null

  return (
    <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e5e5e5' }}>
      <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem' }}>Audio versions</h4>
      <p style={{ fontSize: '0.85rem', color: '#666', margin: '0 0 0.75rem' }}>
        Upload a new mix under the same track URL. Listeners always hear the active version.
      </p>

      {loading ? (
        <p style={{ fontSize: '0.85rem', color: '#888' }}>Loading versions…</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1rem' }}>
          {versions.map((v) => (
            <li
              key={v.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.85rem',
                padding: '0.35rem 0',
              }}
            >
              <span>
                v{v.versionNumber} · {v.versionLabel}
                {v.isActive && (
                  <strong style={{ marginLeft: '0.35rem', color: '#16a34a' }}>active</strong>
                )}
                {v.status !== 'READY' && (
                  <span style={{ marginLeft: '0.35rem', color: '#888' }}>({v.status})</span>
                )}
              </span>
              {!v.isActive && v.status === 'READY' && (
                <button
                  type="button"
                  onClick={() => activate(v.id)}
                  disabled={isPending}
                  style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem' }}
                >
                  Set active
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Version label"
          value={versionLabel}
          onChange={(e) => setVersionLabel(e.target.value)}
          disabled={uploading}
          style={{ padding: '0.35rem 0.5rem', fontSize: '0.85rem', minWidth: 140 }}
        />
        <label
          style={{
            fontSize: '0.85rem',
            padding: '0.35rem 0.65rem',
            background: uploading ? '#ccc' : '#111',
            color: '#fff',
            borderRadius: 4,
            cursor: uploading ? 'default' : 'pointer',
          }}
        >
          {uploading ? 'Uploading…' : 'Upload new version'}
          <input
            type="file"
            accept="audio/*"
            disabled={uploading}
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void handleUpload(f)
              e.target.value = ''
            }}
          />
        </label>
      </div>

      {error && (
        <p style={{ color: '#b91c1c', fontSize: '0.85rem', marginTop: '0.5rem' }}>{error}</p>
      )}
    </div>
  )
}
