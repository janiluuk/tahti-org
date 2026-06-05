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
    <div className="studio-mt-md studio-text-sm">
      <div className="studio-text-strong-sm studio-mb-sm">Mixcloud upload</div>
      {mixcloudConfigured && !mixcloudConnected && (
        <p className="studio-text-muted-sm studio-m-0 studio-mb-sm">
          <a href={`${apiUrl}/api/me/mixcloud/oauth/start`}>Connect Mixcloud</a> to upload this mix.
        </p>
      )}
      {uploadStatus === 'DONE' && mixcloudUrl && (
        <p className="studio-m-0">
          Uploaded —{' '}
          <a href={mixcloudUrl} target="_blank" rel="noreferrer">
            View on Mixcloud
          </a>
        </p>
      )}
      {uploadStatus && uploadStatus !== 'DONE' && (
        <p className="studio-text-muted-sm studio-m-0 studio-mb-sm">Status: {uploadStatus}</p>
      )}
      {!uploadStatus && (
        <button
          type="button"
          onClick={queue}
          disabled={isPending || (mixcloudConfigured && !mixcloudConnected)}
          className="studio-text-muted-sm"
        >
          {isPending ? 'Queueing…' : 'Upload to Mixcloud'}
        </button>
      )}
      {error && <p className="studio-text-error studio-mt-sm studio-m-0">{error}</p>}
    </div>
  )
}
