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
import { Button } from '@tahti/ui'

export function ReleaseTrackVersionPanel({
  releaseId,
  trackId,
  trackTitle,
}: {
  releaseId: string
  trackId: string
  trackTitle: string
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
    void load()
  }, [load])

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

  return (
    <details className="studio-details studio-mt-sm studio-text-sm" open={versions.length === 0}>
      <summary>Versions — {trackTitle}</summary>
      {versions.length > 0 ? (
        <ul className="studio-list-indented">
          {versions.map((v) => (
            <li key={v.id} className="studio-mb-sm">
              v{v.versionNumber} {v.versionLabel} — {v.status}
              {v.isActive ? ' (active)' : ''}
              {v.status === 'READY' && !v.isActive && (
                <Button
                  disabled={isPending}
                  onClick={() => activate(v.id)}
                  variant="ghost"
                  size="sm"
                  className="studio-ml-sm"
                >
                  Activate
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="studio-text-muted-sm studio-my-xs">No audio yet — upload the first version below.</p>
      )}
      <div className="studio-row studio-row--wrap studio-gap-xs">
        <input
          placeholder="Version label"
          value={versionLabel}
          onChange={(e) => setVersionLabel(e.target.value)}
          className="studio-input studio-flex-1"
        />
        <label className="studio-text-muted-sm">
          New audio
          <input
            type="file"
            accept="audio/*"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void handleUpload(f)
            }}
            className="studio-file-input"
          />
        </label>
      </div>
      {error && <p className="studio-text-error">{error}</p>}
    </details>
  )
}
