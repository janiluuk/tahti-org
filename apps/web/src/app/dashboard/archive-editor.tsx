// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { TracklistEntry } from '@tahti/shared'
import { updateArchiveMetadata } from './archive-actions'
import {
  ArchiveMetadataFields,
  metadataFormToPayload,
  metadataFromApi,
  type ArchiveMetadataFormState,
} from './archive-metadata-fields'
import { TracklistEditor } from './tracklist-editor'
import { ArchiveVersionPanel } from './archive-version-panel'
import { ArchiveGateStats } from './archive-gate-stats'
import { ArchiveMixcloudUpload } from './archive-mixcloud'
import ArchiveVisualPanel from './archive-visual-panel'

export default function ArchiveEditor({
  item,
  mixcloudConnected,
  mixcloudConfigured,
  apiUrl,
}: {
  item: Record<string, unknown> & { id: string; title: string; status: string }
  mixcloudConnected: boolean
  mixcloudConfigured: boolean
  apiUrl: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(item.title)
  const [meta, setMeta] = useState<ArchiveMetadataFormState>(() => metadataFromApi(item))
  const [tracklist, setTracklist] = useState<TracklistEntry[] | null>(
    (item.tracklist as TracklistEntry[] | null) ?? null,
  )
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function save() {
    setError(null)
    startTransition(async () => {
      const res = await updateArchiveMetadata(item.id, {
        title: title.trim(),
        tracklist,
        ...metadataFormToPayload(meta),
      })
      if (res.error) {
        setError(res.error)
        return
      }
      setOpen(false)
      router.refresh()
    })
  }

  const detectedBpm = item.bpmDetected as number | null | undefined
  const detectedKey = item.keyDetected as string | null | undefined

  return (
    <li className="studio-item-row--list">
      <div className="studio-card-row">
        <div>
          <div className="studio-stat-box-title">{item.title}</div>
          <div className="studio-text-muted-sm">
            {item.status as string}
            {item.contentType != null && ` · ${String(item.contentType).replace(/_/g, ' ')}`}
            {item.genre != null && ` · ${String(item.genre)}`}
          </div>
        </div>
        <button type="button" onClick={() => setOpen(!open)} className="studio-btn-ghost">
          {open ? 'Close' : 'Edit metadata'}
        </button>
      </div>

      {open && (
        <div className="studio-editor-panel">
          <label className="studio-field">
            <span className="studio-label">Title</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isPending}
              className="studio-input"
            />
          </label>

          <ArchiveMetadataFields
            state={meta}
            onChange={setMeta}
            disabled={isPending}
            detectedBpm={detectedBpm ?? null}
            detectedKey={detectedKey ?? null}
          />

          <TracklistEditor value={tracklist} onChange={setTracklist} disabled={isPending} />

          <ArchiveGateStats
            itemId={item.id}
            repostToDownload={meta.repostToDownload}
            followToDownload={meta.followToDownload}
          />

          <ArchiveVersionPanel itemId={item.id} itemStatus={item.status} />

          <ArchiveVisualPanel
            itemId={item.id}
            initial={{ visualPreset: ((item.visualPreset as string | undefined) ?? 'MINIMAL') as import('@tahti/shared').VisualPreset }}
          />

          <ArchiveMixcloudUpload
            itemId={item.id}
            itemStatus={item.status}
            mixcloudConnected={mixcloudConnected}
            mixcloudConfigured={mixcloudConfigured}
            apiUrl={apiUrl}
          />

          <div className="studio-actions studio-mt-lg">
            <button
              type="button"
              onClick={save}
              disabled={isPending || !title.trim()}
              className="studio-btn-primary"
            >
              {isPending ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="studio-btn-ghost">
              Cancel
            </button>
          </div>
          {error && <p className="studio-text-error">{error}</p>}
        </div>
      )}
    </li>
  )
}
