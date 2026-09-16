// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import { Button, ButtonIcon } from '@tahti/ui'
import { importEmbedTrackAudio } from './sound-actions'

/** No push-status channel for this yet, same as SoundHearthisExportPanel —
 * a successful trigger just confirms the localize job was queued (202
 * Accepted), not that it finished. The user has to reopen the editor to see
 * a queued job's outcome (embedUri clears once it's done). */
export function SoundEmbedImportPanel({ itemId }: { itemId: string }) {
  const [status, setStatus] = useState<'idle' | 'importing' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function onImport() {
    setStatus('importing')
    setError(null)
    const result = await importEmbedTrackAudio(itemId)
    if (result.error) {
      setStatus('error')
      setError(result.error)
      return
    }
  }

  return (
    <div className="studio-field--block">
      <span className="studio-label">Import real audio</span>
      <p className="studio-text-muted-sm studio-m-0">
        This track only plays as an embed. If the artist enabled downloads on hearthis.at, Tahti can
        pull the audio down and use it directly — the embed goes away once that&apos;s done.
      </p>

      <div className="studio-row studio-row--wrap studio-mt-sm">
        <Button
          onClick={() => void onImport()}
          disabled={status === 'importing'}
          variant="secondary"
          size="sm"
        >
          <ButtonIcon name="download" />
          {status === 'importing' ? 'Importing…' : 'Import'}
        </Button>
      </div>

      {status === 'importing' && (
        <p className="studio-text-muted-sm studio-mt-xs">
          Import queued — this runs in the background. Reopen this track in a bit to see whether it
          went through.
        </p>
      )}
      {status === 'error' && error && <p className="studio-text-error studio-mt-xs">{error}</p>}
    </div>
  )
}
