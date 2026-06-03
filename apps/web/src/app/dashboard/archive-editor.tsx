// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateArchiveMetadata } from './archive-actions'
import {
  ArchiveMetadataFields,
  metadataFormToPayload,
  metadataFromApi,
  type ArchiveMetadataFormState,
} from './archive-metadata-fields'

export default function ArchiveEditor({
  item,
}: {
  item: Record<string, unknown> & { id: string; title: string; status: string }
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(item.title)
  const [meta, setMeta] = useState<ArchiveMetadataFormState>(() => metadataFromApi(item))
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function save() {
    setError(null)
    startTransition(async () => {
      const res = await updateArchiveMetadata(item.id, {
        title: title.trim(),
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
    <li style={{ padding: '0.75rem 0', borderBottom: '1px solid #f0f0f0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
        <div>
          <div style={{ fontWeight: 500 }}>{item.title}</div>
          <div style={{ fontSize: '0.85rem', color: '#666' }}>
            {item.status as string}
            {item.contentType != null && ` · ${String(item.contentType).replace(/_/g, ' ')}`}
            {item.genre != null && ` · ${String(item.genre)}`}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          style={{ border: '1px solid #ccc', borderRadius: 4, padding: '0.25rem 0.6rem' }}
        >
          {open ? 'Close' : 'Edit metadata'}
        </button>
      </div>

      {open && (
        <div
          style={{
            marginTop: '1rem',
            padding: '1rem',
            background: '#fafafa',
            borderRadius: 8,
            border: '1px solid #eee',
          }}
        >
          <label style={{ display: 'block', marginBottom: '0.75rem' }}>
            <span style={{ fontWeight: 500 }}>Title</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isPending}
              style={{
                display: 'block',
                width: '100%',
                marginTop: '0.25rem',
                padding: '0.4rem 0.6rem',
                border: '1px solid #ccc',
                borderRadius: 4,
              }}
            />
          </label>

          <ArchiveMetadataFields
            state={meta}
            onChange={setMeta}
            disabled={isPending}
            detectedBpm={detectedBpm ?? null}
            detectedKey={detectedKey ?? null}
          />

          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={save}
              disabled={isPending || !title.trim()}
              style={{
                padding: '0.5rem 1rem',
                background: '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
              }}
            >
              {isPending ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
          {error && <p style={{ color: '#b91c1c', fontSize: '0.875rem' }}>{error}</p>}
        </div>
      )}
    </li>
  )
}
