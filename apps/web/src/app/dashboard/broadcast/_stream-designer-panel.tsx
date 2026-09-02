'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useEffect, useState } from 'react'
import type { VisualPreset } from '@tahti/shared'
import { Button, ButtonIcon, FileDropzone } from '@tahti/ui'
import { VisualPresetPicker } from '@/components/visuals/visual-preset-picker'

interface StreamOverlay {
  streamOverlayTitle: string | null
  streamOverlaySubtitle: string | null
  streamOverlayCoverUrl: string | null
  streamOverlayBackdropUrl: string | null
  streamOverlayVisualPreset: VisualPreset
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001'

type UploadTarget = 'cover' | 'backdrop'

/** Icon-button-triggered panel for what's baked into the RTMP mirror pushes'
 * video track (see buildRtmpMirrorOutput): overlay text + visualizer preset,
 * plus the show's cover/backdrop images. Distinct from each platform's own
 * stream title, which we don't control over RTMP. */
export function StreamDesignerPanel({ initial }: { initial: StreamOverlay }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(initial.streamOverlayTitle ?? '')
  const [subtitle, setSubtitle] = useState(initial.streamOverlaySubtitle ?? '')
  const [coverUrl, setCoverUrl] = useState(initial.streamOverlayCoverUrl ?? '')
  const [backdropUrl, setBackdropUrl] = useState(initial.streamOverlayBackdropUrl ?? '')
  const [visualPreset, setVisualPreset] = useState<VisualPreset>(initial.streamOverlayVisualPreset)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [uploadTarget, setUploadTarget] = useState<UploadTarget | null>(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

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
          streamOverlayVisualPreset: visualPreset,
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

  async function uploadImage(target: UploadTarget, files: File[]) {
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
      const field = target === 'cover' ? 'streamOverlayCoverUrl' : 'streamOverlayBackdropUrl'
      const saveImage = await fetch(`${API_BASE}/api/me/channel/stream-overlay`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ [field]: result.url }),
      })
      if (!saveImage.ok) throw new Error('Could not save image')
      if (target === 'cover') setCoverUrl(result.url)
      else setBackdropUrl(result.url)
      setUploadTarget(null)
      setSaved(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Image upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label="Open stream designer"
        title="Stream designer"
      >
        <ButtonIcon name="edit" />
        Stream designer
      </Button>

      {open && (
        <div
          className="stream-designer__overlay"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false)
          }}
        >
          <div
            className="stream-designer__card"
            role="dialog"
            aria-modal="true"
            aria-label="Stream designer"
          >
            <div className="studio-row studio-row--between">
              <h2 className="studio-section-title">Stream designer</h2>
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Close
              </Button>
            </div>
            <p className="studio-text-muted-sm studio-mb-md">
              What&apos;s baked into your YouTube/Twitch/etc. mirror pushes — RTMP has no title
              metadata of its own. Leave text blank to use your display name and avatar.
            </p>

            {error && <p className="studio-notice studio-notice--error studio-mb-sm">{error}</p>}
            {saved && !error && (
              <p className="studio-notice studio-notice--success studio-mb-sm">Saved</p>
            )}

            <section className="stream-designer__block">
              <h3 className="stream-designer__block-title">Overlay</h3>
              <div className="studio-field">
                <label className="studio-label" htmlFor="stream-designer-title">
                  Overlay title
                </label>
                <input
                  id="stream-designer-title"
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
                <label className="studio-label" htmlFor="stream-designer-subtitle">
                  Overlay subtitle
                </label>
                <input
                  id="stream-designer-subtitle"
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
              <div className="studio-field--block">
                <span className="studio-label">Visualizer</span>
                <VisualPresetPicker
                  value={visualPreset}
                  onChange={(preset) => {
                    setVisualPreset(preset)
                    setSaved(false)
                  }}
                  disabled={saving}
                />
              </div>
              <Button onClick={() => void save()} disabled={saving} variant="primary">
                <ButtonIcon name="save" />
                {saving ? 'Saving…' : 'Save overlay'}
              </Button>
            </section>

            <section className="stream-designer__block">
              <h3 className="stream-designer__block-title">Show info</h3>
              <div className="stream-designer__images">
                <div className="stream-designer__image-field">
                  <span className="studio-label">Cover</span>
                  <button
                    type="button"
                    className="stream-overlay-cover-avatar"
                    onClick={() => setUploadTarget('cover')}
                    aria-label={coverUrl ? 'Change show cover image' : 'Upload show cover image'}
                    title="Upload show cover image"
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
                </div>
                <div className="stream-designer__image-field">
                  <span className="studio-label">Backdrop</span>
                  <button
                    type="button"
                    className="stream-designer__backdrop-placeholder"
                    onClick={() => setUploadTarget('backdrop')}
                    aria-label={
                      backdropUrl ? 'Change show backdrop image' : 'Upload show backdrop image'
                    }
                    title="Upload show backdrop image"
                  >
                    {backdropUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={backdropUrl} alt="" />
                    ) : (
                      <span aria-hidden>+</span>
                    )}
                    <span className="stream-overlay-cover-avatar__action" aria-hidden>
                      ↑
                    </span>
                  </button>
                </div>
              </div>
              <p className="studio-text-muted-sm studio-m-0">
                Click a placeholder to upload a new image.
              </p>
            </section>
          </div>
        </div>
      )}

      {uploadTarget && (
        <div
          className="stream-overlay-upload-modal"
          role="dialog"
          aria-modal="true"
          aria-label={`Upload ${uploadTarget === 'cover' ? 'cover' : 'backdrop'} image`}
          onClick={() => !uploading && setUploadTarget(null)}
        >
          <div className="stream-overlay-upload-modal__card" onClick={(e) => e.stopPropagation()}>
            <div className="studio-row studio-row--between">
              <h2 className="studio-section-title">
                Upload {uploadTarget === 'cover' ? 'cover' : 'backdrop'} image
              </h2>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={uploading}
                onClick={() => setUploadTarget(null)}
              >
                Close
              </Button>
            </div>
            <FileDropzone
              label={uploading ? 'Uploading…' : 'Drop an image here, or click to browse'}
              hint="JPEG, PNG, or WebP — up to 20 MB"
              accept="image/jpeg,image/png,image/webp"
              disabled={uploading}
              onFiles={(files) => void uploadImage(uploadTarget, files)}
            />
          </div>
        </div>
      )}
    </>
  )
}
