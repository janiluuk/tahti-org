// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { prepareUpload, completeUpload, getArchiveItemStatus } from './actions'
import {
  ArchiveMetadataFields,
  defaultMetadataFormState,
  metadataFormToPayload,
} from './archive-metadata-fields'

type UploadState =
  | 'idle'
  | 'preparing'
  | 'uploading'
  | 'completing'
  | 'transcoding'
  | 'done'
  | 'error'

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export default function UploadForm({ onUploaded }: { onUploaded?: () => void }) {
  const router = useRouter()
  const [state, setState] = useState<UploadState>('idle')
  const [progress, setProgress] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')
  const [showMeta, setShowMeta] = useState(true)
  const [meta, setMeta] = useState(defaultMetadataFormState)
  const fileRef = useRef<HTMLInputElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const file = fileRef.current?.files?.[0]
    const title = titleRef.current?.value?.trim()

    if (!file || !title) return

    setErrorMsg('')
    setState('preparing')
    setProgress(0)

    try {
      const { uploadId, uploadUrl } = await prepareUpload({
        title,
        filename: file.name,
        contentType: file.type || 'audio/mpeg',
        fileSizeBytes: file.size,
      })

      setState('uploading')

      const xhr = new XMLHttpRequest()
      const etag = await new Promise<string>((resolve, reject) => {
        xhr.upload.addEventListener('progress', (ev) => {
          if (ev.lengthComputable) {
            setProgress(Math.round((ev.loaded / ev.total) * 100))
          }
        })
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            const responseEtag =
              xhr.getResponseHeader('ETag') ?? xhr.getResponseHeader('etag') ?? ''
            resolve(responseEtag.replace(/"/g, ''))
          } else {
            reject(new Error(`Upload failed: ${xhr.status}`))
          }
        })
        xhr.addEventListener('error', () => reject(new Error('Network error during upload')))
        xhr.open('PUT', uploadUrl)
        xhr.setRequestHeader('Content-Type', file.type || 'audio/mpeg')
        xhr.send(file)
      })

      setState('completing')
      const { itemId, status: initialStatus } = await completeUpload({
        uploadId,
        etag,
        title,
        metadata: metadataFormToPayload(meta),
      })

      if (initialStatus !== 'READY') {
        setState('transcoding')
        setProgress(0)
        for (let attempt = 0; attempt < 90; attempt++) {
          const { status } = await getArchiveItemStatus(itemId)
          if (status === 'READY') break
          if (status === 'FAILED') {
            throw new Error('Transcoding failed — try uploading again')
          }
          setProgress(Math.min(99, Math.round(((attempt + 1) / 90) * 100)))
          await sleep(2000)
        }
      }

      setState('done')
      if (fileRef.current) fileRef.current.value = ''
      if (titleRef.current) titleRef.current.value = ''
      setMeta(defaultMetadataFormState())
      onUploaded?.()
      router.refresh()
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Upload failed')
      setState('error')
    }
  }

  const isLoading =
    state === 'preparing' ||
    state === 'uploading' ||
    state === 'completing' ||
    state === 'transcoding'

  return (
    <form onSubmit={handleSubmit} className="studio-mt-lg">
      <div className="studio-field">
        <label className="studio-label">Title</label>
        <input
          ref={titleRef}
          type="text"
          required
          maxLength={200}
          placeholder="Track or set title"
          disabled={isLoading}
          className="studio-input"
        />
      </div>

      <div className="studio-field">
        <label className="studio-label">Audio file</label>
        <input ref={fileRef} type="file" accept="audio/*" required disabled={isLoading} />
      </div>

      <button type="button" onClick={() => setShowMeta(!showMeta)} className="studio-link-toggle">
        {showMeta ? '▼ Hide metadata' : '▶ Show metadata (genre, BPM, license…)'}
      </button>

      {showMeta && <ArchiveMetadataFields state={meta} onChange={setMeta} disabled={isLoading} />}

      <button type="submit" disabled={isLoading} className="studio-btn-primary studio-mt-lg">
        {state === 'preparing' && 'Preparing...'}
        {state === 'uploading' && `Uploading ${progress}%`}
        {state === 'completing' && 'Registering upload...'}
        {state === 'transcoding' && `Transcoding… ${progress}%`}
        {(state === 'idle' || state === 'done' || state === 'error') && 'Upload'}
      </button>

      {state === 'done' && (
        <p className="studio-text-success studio-mt-sm">
          Uploaded! Transcoding in the background — edit metadata anytime below.
        </p>
      )}

      {state === 'error' && <p className="studio-text-error studio-mt-sm">{errorMsg}</p>}
    </form>
  )
}
