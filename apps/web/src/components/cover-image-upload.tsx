// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useRef, useState } from 'react'

type PrepareResult = { uploadUrl?: string; uploadKey?: string; error?: string | null }
type CompleteResult = { url?: string | null; error?: string | null }
type FromUrlResult = { url?: string | null; error?: string | null }

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

/**
 * Unified cover-image upload widget: drag-and-drop, click-to-browse, or paste a URL
 * (server fetches and rehosts it). Used everywhere an artist attaches a cover/avatar image.
 */
export function CoverImageUpload({
  currentUrl,
  onUploaded,
  prepare,
  complete,
  fromUrl,
  label = 'Cover image',
}: {
  currentUrl?: string | null
  onUploaded: (url: string | null) => void
  prepare: (args: { filename: string; contentType: string }) => Promise<PrepareResult>
  complete: (uploadKey: string) => Promise<CompleteResult>
  fromUrl?: (sourceUrl: string) => Promise<FromUrlResult>
  label?: string
}) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [urlMode, setUrlMode] = useState(false)
  const [urlValue, setUrlValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function onFile(file: File) {
    setError(null)
    const type = file.type || 'image/jpeg'
    if (!ACCEPTED_TYPES.includes(type)) {
      setError('Use JPEG, PNG, or WebP')
      return
    }
    setUploading(true)
    try {
      const prep = await prepare({ filename: file.name, contentType: type })
      if (prep.error || !prep.uploadKey) {
        setError(prep.error ?? 'Prepare failed')
        return
      }
      // A prepare() that omits uploadUrl has already stored the bytes itself — skip the PUT.
      if (prep.uploadUrl) {
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest()
          xhr.open('PUT', prep.uploadUrl!)
          xhr.setRequestHeader('Content-Type', type)
          xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject())
          xhr.onerror = () => reject(new Error('Upload failed'))
          xhr.send(file)
        })
      }
      const done = await complete(prep.uploadKey)
      if (done.error) {
        setError(done.error)
        return
      }
      onUploaded(done.url ?? null)
    } catch {
      setError('Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function onSubmitUrl() {
    if (!fromUrl || !urlValue.trim()) return
    setError(null)
    setUploading(true)
    try {
      const done = await fromUrl(urlValue.trim())
      if (done.error) {
        setError(done.error)
        return
      }
      onUploaded(done.url ?? null)
      setUrlValue('')
      setUrlMode(false)
    } catch {
      setError('Could not fetch that URL')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="cover-upload">
      <div
        className={`cover-upload__zone${dragOver ? ' cover-upload__zone--dragover' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          if (!uploading) setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          if (uploading) return
          const f = e.dataTransfer.files?.[0]
          if (f) void onFile(f)
        }}
        onClick={() => !uploading && !urlMode && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label={label}
        onKeyDown={(e) => {
          if (!uploading && !urlMode && (e.key === 'Enter' || e.key === ' '))
            inputRef.current?.click()
        }}
      >
        {currentUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={currentUrl} alt="" className="cover-upload__preview" />
        ) : (
          <div className="cover-upload__placeholder" aria-hidden />
        )}
        <div className="cover-upload__copy">
          <span className="cover-upload__label">{label}</span>
          <span className="cover-upload__hint">
            {uploading ? 'Uploading…' : 'Drop an image, or click to browse'}
          </span>
        </div>
        {fromUrl && (
          <button
            type="button"
            className="cover-upload__url-toggle"
            title="Use an image URL instead"
            aria-label="Use an image URL instead"
            disabled={uploading}
            onClick={(e) => {
              e.stopPropagation()
              setUrlMode((v) => !v)
              setError(null)
            }}
          >
            🔗
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          disabled={uploading}
          className="cover-upload__file-input"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void onFile(f)
            e.target.value = ''
          }}
        />
      </div>

      {urlMode && fromUrl && (
        <div className="cover-upload__url-row" onClick={(e) => e.stopPropagation()}>
          <input
            type="url"
            value={urlValue}
            disabled={uploading}
            placeholder="https://…"
            className="studio-input studio-flex-1"
            onChange={(e) => setUrlValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void onSubmitUrl()
            }}
          />
          <button
            type="button"
            className="ui-btn ui-btn--sm ui-btn--primary"
            disabled={uploading || !urlValue.trim()}
            onClick={() => void onSubmitUrl()}
          >
            Fetch
          </button>
        </div>
      )}

      {error && (
        <p className="studio-notice studio-notice--error studio-mt-sm studio-m-0">{error}</p>
      )}
    </div>
  )
}
