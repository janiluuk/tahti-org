// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { prepareNewUpload } from './upload-actions'
import { setPendingUpload } from './_pending-uploads'

const ACCEPTED = '.flac,.wav,.aiff,.mp3,.m4a,.ogg,audio/*'
const MAX_SIZE_BYTES = 4 * 1024 * 1024 * 1024 // 4 GB

export function UploadEntryClient() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [preparing, setPreparing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const arr = Array.from(files).filter((f) => f.size > 0)
      if (arr.length === 0) return
      setError(null)
      setPreparing(true)

      // For now handle first file; multi-file: launch each in a tab/queue
      const file = arr[0]!
      if (file.size > MAX_SIZE_BYTES) {
        setError(`File too large (max 4 GB): ${file.name}`)
        setPreparing(false)
        return
      }

      try {
        const result = await prepareNewUpload({
          filename: file.name,
          contentType: file.type || 'audio/flac',
          fileSizeBytes: file.size,
          title: file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '),
        })
        if (result.error) {
          setError(result.error)
          setPreparing(false)
          return
        }
        setPendingUpload(result.uploadId, file, result.uploadUrl)
        router.push(`/dashboard/upload/${encodeURIComponent(result.uploadId)}`)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to prepare upload')
        setPreparing(false)
      }
    },
    [router],
  )

  return (
    <div
      className={`upload-entry__tile upload-entry__tile--drop${dragOver ? ' upload-entry__tile--dragover' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        if (e.dataTransfer.files.length > 0) void handleFiles(e.dataTransfer.files)
      }}
      onClick={() => !preparing && inputRef.current?.click()}
      role="button"
      tabIndex={0}
      aria-label="Upload audio file"
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        multiple
        className="upload-entry__file-input"
        onChange={(e) => {
          if (e.target.files?.length) void handleFiles(e.target.files)
        }}
      />
      <div className="upload-entry__drop-icon" aria-hidden>
        {preparing ? '…' : '↑'}
      </div>
      <p className="upload-entry__drop-label">
        {preparing ? 'Preparing…' : 'Drop a file or click to browse'}
      </p>
      <p className="upload-entry__drop-formats">FLAC · WAV · AIFF · MP3 · M4A · OGG · max 4 GB</p>
      {error && <p className="upload-entry__drop-error">{error}</p>}
    </div>
  )
}
