// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { completeReleaseArtworkUpload, prepareReleaseArtworkUpload } from './release-actions'

export function ReleaseArtworkUpload({
  releaseId,
  artworkUrl,
}: {
  releaseId: string
  artworkUrl: string | null | undefined
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  async function onFile(file: File) {
    setError(null)
    const type = file.type || 'image/jpeg'
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(type)) {
      setError('Use JPEG, PNG, or WebP')
      return
    }
    setUploading(true)
    try {
      const prep = await prepareReleaseArtworkUpload(releaseId, {
        filename: file.name,
        contentType: type,
      })
      if (prep.error || !prep.uploadUrl || !prep.uploadKey) {
        setError(prep.error ?? 'Prepare failed')
        return
      }
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', prep.uploadUrl!)
        xhr.setRequestHeader('Content-Type', type)
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject())
        xhr.onerror = () => reject(new Error('Upload failed'))
        xhr.send(file)
      })
      const done = await completeReleaseArtworkUpload(releaseId, prep.uploadKey)
      if (done.error) {
        setError(done.error)
        return
      }
      router.refresh()
    } catch {
      setError('Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="studio-artwork-wrap">
      {artworkUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={artworkUrl} alt="" width={80} height={80} className="studio-artwork-preview" />
      )}
      <label className="studio-field--block">
        Cover art (MinIO)
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={uploading}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void onFile(f)
          }}
          className="studio-file-input"
        />
      </label>
      {uploading && <span className="studio-text-muted-sm"> Uploading…</span>}
      {error && <p className="studio-text-error studio-mt-sm studio-m-0">{error}</p>}
    </div>
  )
}
