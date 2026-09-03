// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useState, useTransition } from 'react'
import { Button, ButtonIcon } from '@tahti/ui'
import { fetchMixcloudUploadStatus, queueMixcloudUpload } from './mixcloud-actions'

export function SoundMixcloudUpload({
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
  const [open, setOpen] = useState(false)
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
      {uploadStatus === 'DONE' && mixcloudUrl && (
        <p className="studio-m-0">
          Exported —{' '}
          <a href={mixcloudUrl} target="_blank" rel="noreferrer">
            View on Mixcloud
          </a>
        </p>
      )}
      {uploadStatus && uploadStatus !== 'DONE' && (
        <p className="studio-text-muted-sm studio-m-0 studio-mb-sm">
          Mixcloud export: {uploadStatus}
        </p>
      )}
      {!uploadStatus && (
        <>
          <Button type="button" variant="secondary" onClick={() => setOpen((value) => !value)}>
            <ButtonIcon name="download" />
            Export
          </Button>
          {open ? (
            <div className="studio-export-menu studio-mt-sm">
              {mixcloudConfigured && mixcloudConnected ? (
                <div className="studio-export-menu__row">
                  <div>
                    <strong>Mixcloud</strong>
                    <span>Publish this audio to your connected Mixcloud account.</span>
                  </div>
                  <Button type="button" size="sm" disabled={isPending} onClick={queue}>
                    {isPending ? 'Queueing…' : 'Push'}
                  </Button>
                </div>
              ) : (
                <p className="studio-text-muted-sm studio-m-0">
                  No export destinations configured.{' '}
                  {mixcloudConfigured ? (
                    <a href={`${apiUrl}/api/me/mixcloud/oauth/start`}>Connect Mixcloud</a>
                  ) : (
                    <a href="/dashboard/settings/connections#social">Open Connections</a>
                  )}
                  .
                </p>
              )}
            </div>
          ) : null}
        </>
      )}
      {error && <p className="studio-text-error studio-mt-sm studio-m-0">{error}</p>}
    </div>
  )
}
