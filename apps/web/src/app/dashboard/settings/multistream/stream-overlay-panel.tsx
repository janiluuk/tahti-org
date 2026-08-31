'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useState } from 'react'
import { Button, ButtonIcon, FileDropzone, Panel } from '@tahti/ui'

interface StreamOverlay {
  streamOverlayTitle: string | null
  streamOverlaySubtitle: string | null
  streamOverlayCoverUrl: string | null
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001'

/** YouTube/Twitch reject audio-only RTMP, so every mirror push carries a static
 * video frame — this is what's baked into it. Distinct from each *platform's*
 * own stream title (set in YouTube Studio / Twitch dashboard, out of our
 * control over RTMP), this is Tahti's own overlay text + cover image. */
export function StreamOverlayPanel({ initial }: { initial: StreamOverlay }) {
  const [title, setTitle] = useState(initial.streamOverlayTitle ?? '')
  const [subtitle, setSubtitle] = useState(initial.streamOverlaySubtitle ?? '')
  const [coverUrl, setCoverUrl] = useState(initial.streamOverlayCoverUrl ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploading, setUploading] = useState(false)

  async function save() {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const res = await fetch(`${API_BASE}/api/me/channel/stream-overlay`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          streamOverlayTitle: title.trim(),
          streamOverlaySubtitle: subtitle.trim(),
          streamOverlayCoverUrl: coverUrl.trim(),
        }),
      })
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(d.error ?? 'Failed to save')
      }
      setSaved(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  async function uploadCover(files: File[]) {
    const file = files[0]
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const prep = await fetch(`${API_BASE}/api/me/media/prepare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ filename: file.name, contentType: file.type }),
      })
      if (!prep.ok) throw new Error('Could not prepare image upload')
      const prepared = (await prep.json()) as { uploadKey: string; uploadUrl: string }
      const put = await fetch(prepared.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      })
      if (!put.ok) throw new Error('Image upload failed')
      const complete = await fetch(`${API_BASE}/api/me/media/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          uploadKey: prepared.uploadKey,
          filename: file.name,
          contentType: file.type,
          sizeBytes: file.size,
        }),
      })
      if (!complete.ok) throw new Error('Could not finish image upload')
      const result = (await complete.json()) as { url: string }
      const saveCover = await fetch(`${API_BASE}/api/me/channel/stream-overlay`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ streamOverlayCoverUrl: result.url }),
      })
      if (!saveCover.ok) throw new Error('Could not save overlay cover')
      setCoverUrl(result.url)
      setUploadOpen(false)
      setSaved(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Image upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <Panel
      className="studio-mt-lg"
      title="Stream overlay"
      description="RTMP has no built-in title metadata, so YouTube/Twitch/etc. mirrors carry a static video frame with this text and cover baked in. Leave blank to use your display name and avatar."
    >
      {error && <p className="studio-notice studio-notice--error studio-mb-sm">{error}</p>}
      {saved && !error && (
        <p className="studio-notice studio-notice--success studio-mb-sm">Saved</p>
      )}

      <div className="studio-field">
        <label className="studio-label" htmlFor="overlay-title">
          Overlay title
        </label>
        <input
          id="overlay-title"
          type="text"
          className="studio-input"
          placeholder="Your display name"
          maxLength={80}
          value={title}
          onChange={(e) => {
            setTitle(e.target.value)
            setSaved(false)
          }}
        />
      </div>

      <div className="studio-field">
        <label className="studio-label" htmlFor="overlay-subtitle">
          Overlay subtitle
        </label>
        <input
          id="overlay-subtitle"
          type="text"
          className="studio-input"
          placeholder="e.g. Every Friday, 8pm CET"
          maxLength={120}
          value={subtitle}
          onChange={(e) => {
            setSubtitle(e.target.value)
            setSaved(false)
          }}
        />
      </div>

      <div className="studio-field stream-overlay-cover-field">
        <span className="studio-label">Overlay cover</span>
        <button
          type="button"
          className="stream-overlay-cover-avatar"
          onClick={() => setUploadOpen(true)}
          aria-label={coverUrl ? 'Change overlay cover image' : 'Upload overlay cover image'}
          title="Upload overlay cover image"
        >
          {coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverUrl} alt="" />
          ) : (
            <span aria-hidden>+</span>
          )}
          <span className="stream-overlay-cover-avatar__action" aria-hidden>
            ↑
          </span>
        </button>
        <span className="studio-text-muted-sm">Click the cover to upload a logo or artwork.</span>
      </div>

      <Button onClick={() => void save()} disabled={saving} variant="primary">
        <ButtonIcon name="save" />
        {saving ? 'Saving…' : 'Save overlay'}
      </Button>

      {uploadOpen && (
        <div
          className="stream-overlay-upload-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Upload overlay cover"
          onClick={() => !uploading && setUploadOpen(false)}
        >
          <div className="stream-overlay-upload-modal__card" onClick={(e) => e.stopPropagation()}>
            <div className="studio-row studio-row--between">
              <h2 className="studio-section-title">Upload overlay cover</h2>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={uploading}
                onClick={() => setUploadOpen(false)}
              >
                Close
              </Button>
            </div>
            <FileDropzone
              label={uploading ? 'Uploading…' : 'Drop an image here, or click to browse'}
              hint="JPEG, PNG, or WebP — up to 20 MB"
              accept="image/jpeg,image/png,image/webp"
              disabled={uploading}
              onFiles={(files) => void uploadCover(files)}
            />
          </div>
        </div>
      )}
    </Panel>
  )
}
