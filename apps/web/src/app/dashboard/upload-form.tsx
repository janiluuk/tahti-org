// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { prepareUpload, completeUpload } from './actions'
import {
  ArchiveMetadataFields,
  defaultMetadataFormState,
  metadataFormToPayload,
} from './archive-metadata-fields'

type UploadState = 'idle' | 'preparing' | 'uploading' | 'completing' | 'done' | 'error'

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
      await completeUpload({
        uploadId,
        etag,
        title,
        metadata: metadataFormToPayload(meta),
      })

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

  const isLoading = state === 'preparing' || state === 'uploading' || state === 'completing'

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: '1rem' }}>
      <div style={{ marginBottom: '0.75rem' }}>
        <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Title</label>
        <input
          ref={titleRef}
          type="text"
          required
          maxLength={200}
          placeholder="Track or set title"
          disabled={isLoading}
          style={{
            width: '100%',
            padding: '0.4rem 0.6rem',
            border: '1px solid #ccc',
            borderRadius: 4,
            fontSize: '1rem',
          }}
        />
      </div>

      <div style={{ marginBottom: '0.75rem' }}>
        <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>
          Audio file
        </label>
        <input ref={fileRef} type="file" accept="audio/*" required disabled={isLoading} />
      </div>

      <button
        type="button"
        onClick={() => setShowMeta(!showMeta)}
        style={{
          marginBottom: '0.5rem',
          background: 'none',
          border: 'none',
          color: '#2563eb',
          cursor: 'pointer',
          padding: 0,
        }}
      >
        {showMeta ? '▼ Hide metadata' : '▶ Show metadata (genre, BPM, license…)'}
      </button>

      {showMeta && <ArchiveMetadataFields state={meta} onChange={setMeta} disabled={isLoading} />}

      <button
        type="submit"
        disabled={isLoading}
        style={{
          marginTop: '1rem',
          padding: '0.5rem 1.2rem',
          background: '#2563eb',
          color: '#fff',
          border: 'none',
          borderRadius: 4,
          cursor: isLoading ? 'not-allowed' : 'pointer',
          opacity: isLoading ? 0.7 : 1,
        }}
      >
        {state === 'preparing' && 'Preparing...'}
        {state === 'uploading' && `Uploading ${progress}%`}
        {state === 'completing' && 'Processing...'}
        {(state === 'idle' || state === 'done' || state === 'error') && 'Upload'}
      </button>

      {state === 'done' && (
        <p style={{ color: '#16a34a', marginTop: '0.5rem' }}>
          Uploaded! Transcoding in the background — edit metadata anytime below.
        </p>
      )}

      {state === 'error' && <p style={{ color: '#dc2626', marginTop: '0.5rem' }}>{errorMsg}</p>}
    </form>
  )
}
