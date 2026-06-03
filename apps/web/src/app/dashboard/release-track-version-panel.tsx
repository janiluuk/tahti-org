// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import type { ReleaseTrackVersionRow } from '@tahti/shared'
import {
  activateReleaseTrackVersion,
  completeReleaseTrackVersionUpload,
  fetchReleaseTrackVersions,
  prepareReleaseTrackVersionUpload,
} from './release-actions'

export function ReleaseTrackVersionPanel({
  releaseId,
  trackId,
  trackTitle,
  trackStatus,
}: {
  releaseId: string
  trackId: string
  trackTitle: string
  trackStatus: string
}) {
  const [versions, setVersions] = useState<ReleaseTrackVersionRow[]>([])
  const [versionLabel, setVersionLabel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [isPending, startTransition] = useTransition()

  const load = useCallback(async () => {
    const res = await fetchReleaseTrackVersions(releaseId, trackId)
    if (res.error) setError(res.error)
    else if (res.versions) setVersions(res.versions)
    setLoading(false)
  }, [releaseId, trackId])

  useEffect(() => {
    if (trackStatus === 'READY' || trackStatus === 'FAILED') void load()
    else setLoading(false)
  }, [trackStatus, load])

  async function handleUpload(file: File) {
    const label = versionLabel.trim()
    if (!label) {
      setError('Enter a version label')
      return
    }
    setError(null)
    setUploading(true)
    try {
      const prep = await prepareReleaseTrackVersionUpload(releaseId, trackId, {
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
      const done = await completeReleaseTrackVersionUpload(releaseId, trackId, {
        uploadId: prep.uploadId,
        versionLabel: label,
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
    startTransition(async () => {
      const res = await activateReleaseTrackVersion(releaseId, trackId, versionId)
      if (res.error) setError(res.error)
      else await load()
    })
  }

  if (loading) return null
  if (trackStatus !== 'READY' && trackStatus !== 'FAILED' && versions.length === 0) {
    return (
      <p style={{ fontSize: '0.8rem', color: '#888', margin: '0.25rem 0' }}>
        Upload audio for this track before managing versions.
      </p>
    )
  }

  return (
    <details style={{ marginTop: '0.35rem', fontSize: '0.8rem' }}>
      <summary style={{ cursor: 'pointer', color: '#2563eb' }}>Versions — {trackTitle}</summary>
      <ul style={{ margin: '0.35rem 0', paddingLeft: '1.1rem' }}>
        {versions.map((v) => (
          <li key={v.id} style={{ marginBottom: '0.2rem' }}>
            v{v.versionNumber} {v.versionLabel} — {v.status}
            {v.isActive ? ' (active)' : ''}
            {v.status === 'READY' && !v.isActive && (
              <button
                type="button"
                disabled={isPending}
                onClick={() => activate(v.id)}
                style={{ marginLeft: '0.35rem', fontSize: '0.75rem' }}
              >
                Activate
              </button>
            )}
          </li>
        ))}
      </ul>
      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          placeholder="Version label"
          value={versionLabel}
          onChange={(e) => setVersionLabel(e.target.value)}
          style={{ padding: '0.25rem', border: '1px solid #ccc', borderRadius: 4, flex: 1 }}
        />
        <label style={{ fontSize: '0.75rem' }}>
          New audio
          <input
            type="file"
            accept="audio/*"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void handleUpload(f)
            }}
            style={{ display: 'block', marginTop: '0.15rem' }}
          />
        </label>
      </div>
      {error && <p style={{ color: '#dc2626' }}>{error}</p>}
    </details>
  )
}
