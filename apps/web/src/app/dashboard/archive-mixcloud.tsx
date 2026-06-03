// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useState, useTransition } from 'react'
import { fetchMixcloudUploadStatus, queueMixcloudUpload } from './mixcloud-actions'

export function ArchiveMixcloudUpload({
  itemId,
  itemStatus,
  mixcloudConfigured,
  mixcloudConnected,
  apiUrl,
}: {
  itemId: string
  itemStatus: string
  mixcloudConfigured: boolean
  mixcloudConnected: boolean
  apiUrl: string
}) {
  const [uploadStatus, setUploadStatus] = useState<string | null>(null)
  const [mixcloudUrl, setMixcloudUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (itemStatus !== 'READY') return
    void fetchMixcloudUploadStatus(itemId).then((res) => {
      if (res.status) setUploadStatus(res.status)
      if (res.mixcloudUrl) setMixcloudUrl(res.mixcloudUrl)
    })
  }, [itemId, itemStatus])

  if (itemStatus !== 'READY') return null

  function queue() {
    setError(null)
    startTransition(async () => {
      const res = await queueMixcloudUpload(itemId)
      if (res.error) {
        setError(res.error)
        return
      }
      setUploadStatus('PENDING')
    })
  }

  return (
    <div style={{ marginTop: '0.75rem', fontSize: '0.9rem' }}>
      <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Mixcloud upload</div>
      {mixcloudConfigured && !mixcloudConnected && (
        <p style={{ color: '#666', margin: '0 0 0.35rem' }}>
          <a href={`${apiUrl}/api/me/mixcloud/oauth/start`}>Connect Mixcloud</a> to upload this mix.
        </p>
      )}
      {uploadStatus === 'DONE' && mixcloudUrl && (
        <p style={{ margin: 0 }}>
          Uploaded —{' '}
          <a href={mixcloudUrl} target="_blank" rel="noreferrer">
            View on Mixcloud
          </a>
        </p>
      )}
      {uploadStatus && uploadStatus !== 'DONE' && (
        <p style={{ color: '#666', margin: '0 0 0.35rem' }}>Status: {uploadStatus}</p>
      )}
      {!uploadStatus && (
        <button
          type="button"
          onClick={queue}
          disabled={isPending || (mixcloudConfigured && !mixcloudConnected)}
          style={{ fontSize: '0.85rem' }}
        >
          {isPending ? 'Queueing…' : 'Upload to Mixcloud'}
        </button>
      )}
      {error && <p style={{ color: '#b91c1c', margin: '0.35rem 0 0' }}>{error}</p>}
    </div>
  )
}
