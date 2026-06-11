// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState, useTransition } from 'react'
import type { ArchiveVersionRow } from '@tahti/shared'
import { ArchiveTrimEditor } from './archive-trim-editor'
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
    <div className="studio-divider">
      <h4 className="studio-text-strong-sm studio-m-0 studio-mb-sm">Audio versions</h4>
      <p className="studio-text-muted-sm studio-m-0 studio-mb-md">
        Upload a new mix under the same track URL. Listeners always hear the active version.
      </p>

      {loading ? (
        <p className="studio-text-muted-sm">Loading versions…</p>
      ) : (
        <ul className="studio-list studio-mb-lg">
          {versions.map((v) => (
            <li key={v.id} className="studio-row--between studio-text-muted-sm">
              <span>
                v{v.versionNumber} · {v.versionLabel}
                {v.sourceFormat != null &&
                  ` · ${v.sourceFormat}${
                    v.sourceBitrateKbps != null ? ` ${v.sourceBitrateKbps} kbps` : ' (lossless)'
                  }`}
                {v.isActive && <strong className="studio-badge--success"> active</strong>}
                {v.status !== 'READY' && (
                  <span className="studio-text-muted-sm"> ({v.status})</span>
                )}
              </span>
              {!v.isActive && v.status === 'READY' && (
                <button
                  type="button"
                  onClick={() => activate(v.id)}
                  disabled={isPending}
                  className="studio-btn-ghost"
                >
                  Set active
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <ArchiveTrimEditor itemId={itemId} onBounced={load} />

      <div className="studio-row studio-mb-md">
        <Link href={`/dashboard/editor?archiveItemId=${itemId}`} className="studio-btn-ghost">
          Open in multitrack editor
        </Link>
      </div>

      <div className="studio-row studio-row--wrap">
        <input
          type="text"
          placeholder="Version label"
          value={versionLabel}
          onChange={(e) => setVersionLabel(e.target.value)}
          disabled={uploading}
          className="studio-input studio-input--grow"
        />
        <label className={`studio-file-label${uploading ? ' studio-file-label--disabled' : ''}`}>
          {uploading ? 'Uploading…' : 'Upload new version'}
          <input
            type="file"
            accept="audio/*"
            disabled={uploading}
            className="studio-hidden-input"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void handleUpload(f)
              e.target.value = ''
            }}
          />
        </label>
      </div>

      {error && <p className="studio-text-error studio-mt-sm studio-m-0">{error}</p>}
    </div>
  )
}
