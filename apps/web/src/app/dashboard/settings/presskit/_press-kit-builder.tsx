'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useState } from 'react'
import Link from 'next/link'
import { Button, ButtonIcon, FileDropzone, Panel, SortableList } from '@tahti/ui'
import type { PressKitImageItem } from '@tahti/shared'
import {
  completePressKitImageUpload,
  deletePressKitImage,
  preparePressKitImageUpload,
  updatePressKitGallerySettings,
  updatePressKitImage,
} from '../../press-kit-actions'

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_IMAGES = 30

interface PendingUpload {
  id: string
  name: string
  status: 'uploading' | 'error'
  error?: string
}

/** Full "Create presskit" flow: multi-file drag'n'drop upload, drag-reorder,
 * a live preview of what a promoter sees, and a disabled download when the
 * artist has no material yet (no bio, no photos). */
export function PressKitBuilder({
  initialImages,
  initialGalleryPublic,
  username,
  displayName,
  bio,
  apiUrl,
}: {
  initialImages: PressKitImageItem[]
  initialGalleryPublic: boolean
  username: string
  displayName: string
  bio: string | null
  apiUrl: string
}) {
  const [images, setImages] = useState(initialImages)
  const [galleryPublic, setGalleryPublic] = useState(initialGalleryPublic)
  const [pending, setPending] = useState<PendingUpload[]>([])
  const [error, setError] = useState<string | null>(null)

  const isEmpty = !bio && images.length === 0
  const zipImages = images.filter((i) => i.includeInZip)

  async function uploadOne(file: File) {
    const localId = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const type = file.type || 'image/jpeg'
    if (!ACCEPTED_TYPES.includes(type)) {
      setPending((prev) => [
        ...prev,
        { id: localId, name: file.name, status: 'error', error: 'Use JPEG, PNG, or WebP' },
      ])
      return
    }
    setPending((prev) => [...prev, { id: localId, name: file.name, status: 'uploading' }])
    try {
      const prep = await preparePressKitImageUpload(file.name, type)
      if (prep.error || !prep.uploadKey || !prep.uploadUrl) {
        throw new Error(prep.error ?? 'Prepare failed')
      }
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', prep.uploadUrl!)
        xhr.setRequestHeader('Content-Type', type)
        xhr.onload = () =>
          xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error('Upload failed'))
        xhr.onerror = () => reject(new Error('Upload failed'))
        xhr.send(file)
      })
      const done = await completePressKitImageUpload(prep.uploadKey)
      if (done.error || !done.image) throw new Error(done.error ?? 'Upload failed')
      setImages((prev) => [...prev, done.image!])
      setPending((prev) => prev.filter((p) => p.id !== localId))
    } catch (e) {
      setPending((prev) =>
        prev.map((p) =>
          p.id === localId
            ? { ...p, status: 'error', error: e instanceof Error ? e.message : 'Upload failed' }
            : p,
        ),
      )
    }
  }

  async function uploadFiles(files: FileList | File[]) {
    setError(null)
    const room = Math.max(0, MAX_IMAGES - images.length - pending.length)
    const list = Array.from(files).slice(0, room)
    if (list.length < files.length) {
      setError(`Press kit is limited to ${MAX_IMAGES} images — some files were skipped`)
    }
    for (const file of list) {
      // Sequential, not Promise.all — keeps prepare/PUT/complete round-trips
      // from racing on the same channel's position-append logic.
      await uploadOne(file)
    }
  }

  async function onTitleBlur(id: string, title: string) {
    await updatePressKitImage(id, { title: title.trim() || null })
  }

  async function onToggleIncludeInZip(id: string, includeInZip: boolean) {
    setImages((prev) => prev.map((img) => (img.id === id ? { ...img, includeInZip } : img)))
    const res = await updatePressKitImage(id, { includeInZip })
    if (res.error) setError(res.error)
  }

  async function onDelete(id: string) {
    setImages((prev) => prev.filter((img) => img.id !== id))
    const res = await deletePressKitImage(id)
    if (res.error) setError(res.error)
  }

  async function onReorder(next: PressKitImageItem[]) {
    setImages(next)
    const res = await Promise.all(
      next.map((img, index) => updatePressKitImage(img.id, { position: index })),
    )
    const failed = res.find((r) => r.error)
    if (failed) setError(failed.error)
  }

  async function onToggleGalleryPublic() {
    const next = !galleryPublic
    setGalleryPublic(next)
    const res = await updatePressKitGallerySettings(next)
    if (res.error) {
      setError(res.error)
      setGalleryPublic(!next)
    }
  }

  return (
    <div className="presskit-builder">
      {isEmpty && (
        <div className="studio-empty-card">
          <p className="studio-empty-card__text">Your press kit is empty.</p>
          <p className="studio-empty-card__hint">
            Add a bio in <Link href="/dashboard/settings/artist-info">Artist info</Link> and at
            least one photo below to build a downloadable press kit.
          </p>
        </div>
      )}

      <Panel
        title="Photos"
        headerTight
        description="Drop in high-resolution promo photos. Drag to reorder — the top photo leads the preview and the .zip."
      >
        <FileDropzone
          label="Drop photos here, or click to browse"
          hint={`JPEG, PNG, or WebP — up to ${MAX_IMAGES}`}
          accept={ACCEPTED_TYPES.join(',')}
          multiple
          className="presskit-dropzone"
          onFiles={(files) => void uploadFiles(files)}
        />

        {pending.length > 0 && (
          <ul className="presskit-pending-list">
            {pending.map((p) => (
              <li
                key={p.id}
                className={`presskit-pending-item${p.status === 'error' ? ' presskit-pending-item--error' : ''}`}
              >
                <span>{p.name}</span>
                {p.status === 'uploading' ? (
                  <span className="presskit-pending-item__status">Uploading…</span>
                ) : (
                  <>
                    <span className="presskit-pending-item__status">{p.error}</span>
                    <button
                      type="button"
                      onClick={() => setPending((prev) => prev.filter((x) => x.id !== p.id))}
                      aria-label="Dismiss"
                    >
                      ✕
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}

        {images.length === 0 ? (
          <p className="studio-text-muted-sm">No photos yet — add some above.</p>
        ) : (
          <SortableList
            items={images}
            itemId={(img) => img.id}
            onReorder={(next) => void onReorder(next)}
            as="ul"
            className="studio-presskit-grid"
            renderItem={(img, _index, sortable) => (
              <li
                ref={(el) => sortable.ref(el)}
                className={`studio-presskit-item${sortable.isDragging ? ' studio-presskit-item--dragging' : ''}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.imageUrl} alt="" className="studio-presskit-item__thumb" />
                <input
                  type="text"
                  className="studio-input studio-input--sm"
                  placeholder="Title (optional)"
                  defaultValue={img.title ?? ''}
                  maxLength={120}
                  onBlur={(e) => void onTitleBlur(img.id, e.target.value)}
                />
                <label className="studio-checkbox-row studio-checkbox-row--sm">
                  <input
                    type="checkbox"
                    checked={img.includeInZip}
                    onChange={(e) => void onToggleIncludeInZip(img.id, e.target.checked)}
                  />
                  <span>Include in .zip</span>
                </label>
                <Button
                  onClick={() => void onDelete(img.id)}
                  variant="ghost"
                  size="sm"
                  className="studio-text-error"
                >
                  <ButtonIcon name="trash" />
                  Remove
                </Button>
              </li>
            )}
          />
        )}

        {error && <p className="studio-notice studio-notice--error studio-mt-sm">{error}</p>}
      </Panel>

      <Panel
        title="Gallery"
        headerTight
        description="Optionally show these photos publicly on your profile."
      >
        <label className="studio-checkbox-row">
          <input
            type="checkbox"
            checked={galleryPublic}
            onChange={() => void onToggleGalleryPublic()}
          />
          <span>Show these photos publicly under Gallery on my profile</span>
        </label>
      </Panel>

      <Panel
        title="Preview"
        headerTight
        description="What a promoter sees when they open your press kit."
      >
        <PressKitPreview displayName={displayName} bio={bio} images={zipImages} />
        {isEmpty ? (
          <p className="studio-text-muted-sm studio-mt-sm">
            Add a bio and at least one photo to enable the download.
          </p>
        ) : (
          <a
            href={`${apiUrl}/api/v1/u/${encodeURIComponent(username)}/press-kit.zip`}
            className="ui-btn ui-btn--sm ui-btn--secondary studio-mt-sm"
          >
            <ButtonIcon name="download" />
            Download press kit .zip
          </a>
        )}
      </Panel>
    </div>
  )
}

function PressKitPreview({
  displayName,
  bio,
  images,
}: {
  displayName: string
  bio: string | null
  images: PressKitImageItem[]
}) {
  return (
    <div className="presskit-preview">
      <div className="presskit-preview__header">
        {images[0] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={images[0].imageUrl} alt="" className="presskit-preview__hero" />
        )}
        <h3 className="presskit-preview__name">{displayName}</h3>
      </div>
      {bio ? (
        <p className="presskit-preview__bio">{bio}</p>
      ) : (
        <p className="presskit-preview__bio presskit-preview__bio--empty">No bio yet.</p>
      )}
      {images.length > 1 && (
        <div className="presskit-preview__grid">
          {images.slice(1, 5).map((img) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={img.id} src={img.imageUrl} alt="" />
          ))}
        </div>
      )}
    </div>
  )
}
