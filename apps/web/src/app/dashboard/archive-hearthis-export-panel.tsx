// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useState } from 'react'
import NextLink from 'next/link'
import { Button, ButtonIcon } from '@tahti/ui'
import { listMyIntegrations } from './integrations-actions'
import { exportArchiveToHearthis } from './archive-actions'

type ExportStatus = 'pending' | 'submitted' | 'delivered' | 'failed' | null

/** No push-status channel for this yet — a successful trigger just confirms
 * the job was queued (202 Accepted), not that it finished. delivered/failed
 * only ever reflect what the item already had when the editor loaded; the
 * user has to reopen the editor to see a queued job's outcome. */
export function ArchiveHearthisExportPanel({
  itemId,
  initialStatus,
  initialRemoteId,
}: {
  itemId: string
  initialStatus?: string | null
  initialRemoteId?: string | null
}) {
  const [installed, setInstalled] = useState<boolean | null>(null)
  const [status, setStatus] = useState<ExportStatus>((initialStatus as ExportStatus) ?? null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { integrations } = await listMyIntegrations()
      if (cancelled) return
      setInstalled(integrations.find((i) => i.slug === 'hearthis-export')?.installed ?? false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function onExport() {
    setPending(true)
    setError(null)
    const result = await exportArchiveToHearthis(itemId)
    setPending(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setStatus((result.status as ExportStatus) ?? 'pending')
  }

  if (installed === null) return null

  if (!installed) {
    return (
      <div className="studio-field--block">
        <span className="studio-label">hearthis.at</span>
        <p className="studio-text-muted-sm studio-m-0">
          Install the hearthis.at export plugin (requires hearthis.at Premium) in{' '}
          <NextLink href="/dashboard/settings/integrations">Settings → Integrations</NextLink> to
          push this track to your own hearthis.at account.
        </p>
      </div>
    )
  }

  return (
    <div className="studio-field--block">
      <span className="studio-label">hearthis.at</span>
      <p className="studio-text-muted-sm studio-m-0">
        Push a copy of this track out to your own hearthis.at account.
      </p>

      <div className="studio-row studio-row--wrap studio-mt-sm">
        {status === 'delivered' && initialRemoteId ? (
          <Button onClick={() => void onExport()} disabled={pending} variant="secondary" size="sm">
            <ButtonIcon name="refresh" />
            {pending ? 'Re-exporting…' : 'Re-export'}
          </Button>
        ) : (
          <Button
            onClick={() => void onExport()}
            disabled={pending || status === 'pending' || status === 'submitted'}
            variant="secondary"
            size="sm"
          >
            <ButtonIcon name="send" />
            {pending || status === 'pending' || status === 'submitted'
              ? 'Exporting…'
              : status === 'failed'
                ? 'Retry export'
                : 'Export to hearthis.at'}
          </Button>
        )}
      </div>

      {(status === 'pending' || status === 'submitted') && (
        <p className="studio-text-muted-sm studio-mt-xs">
          Export queued — this runs in the background. Reopen this track in a bit to see whether it
          went through.
        </p>
      )}
      {status === 'failed' && (
        <p className="studio-text-error studio-mt-xs">
          Export failed. Common causes: your hearthis.at Premium subscription lapsed, or the
          plugin&apos;s stored credentials are stale — try reinstalling it in Settings →
          Integrations.
        </p>
      )}
      {error && <p className="studio-text-error studio-mt-xs">{error}</p>}
    </div>
  )
}
