// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useRef, useState } from 'react'
import { ButtonIcon, Button, Panel } from '@tahti/ui'
import type { PressKitImageItem } from '@tahti/shared'
import {
  completePressKitImageUpload,
  deletePressKitImage,
  preparePressKitImageUpload,
  updatePressKitGallerySettings,
  updatePressKitImage,
} from './press-kit-actions'

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export default function PressKitImagesPanel({
  initialImages,
  initialGalleryPublic,
  username,
  apiUrl,
}: {
  initialImages: PressKitImageItem[]
  initialGalleryPublic: boolean
  username: string
  apiUrl: string
}) {
  const [images, setImages] = useState(initialImages)
  const [galleryPublic, setGalleryPublic] = useState(initialGalleryPublic)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
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
      const prep = await preparePressKitImageUpload(file.name, type)
      if (prep.error || !prep.uploadKey || !prep.uploadUrl) {
        setError(prep.error ?? 'Prepare failed')
        return
      }
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', prep.uploadUrl!)
        xhr.setRequestHeader('Content-Type', type)
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject())
        xhr.onerror = () => reject(new Error('Upload failed'))
        xhr.send(file)
      })
      const done = await completePressKitImageUpload(prep.uploadKey)
      if (done.error || !done.image) {
        setError(done.error ?? 'Upload failed')
        return
      }
      setImages((prev) => [...prev, done.image!])
    } catch {
      setError('Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function onTitleChange(id: string, title: string) {
    setImages((prev) => prev.map((img) => (img.id === id ? { ...img, title } : img)))
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
    <Panel
      title="Press kit photos"
      headerTight
      description="Upload high-resolution promo photos for the downloadable press kit. Optionally show them publicly in a gallery on your profile."
    >
      <div className="studio-presskit-toolbar">
        <a
          href={`${apiUrl}/api/v1/u/${encodeURIComponent(username)}/press-kit.zip`}
          className="ui-btn ui-btn--sm ui-btn--secondary"
        >
          <ButtonIcon name="download" />
          Download press kit .zip
        </a>
        <label className="studio-checkbox-row">
          <input
            type="checkbox"
            checked={galleryPublic}
            onChange={() => void onToggleGalleryPublic()}
          />
          <span>Show these photos publicly under Gallery on my profile</span>
        </label>
      </div>

      {images.length === 0 ? (
        <p className="studio-text-muted-sm studio-mb-md">No photos yet — add some below.</p>
      ) : (
        <ul className="studio-presskit-grid">
          {images.map((img) => (
            <li key={img.id} className="studio-presskit-item">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.imageUrl} alt="" className="studio-presskit-item__thumb" />
              <input
                type="text"
                className="studio-input studio-input--sm"
                placeholder="Title (optional)"
                value={img.title ?? ''}
                maxLength={120}
                onChange={(e) => onTitleChange(img.id, e.target.value)}
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
          ))}
        </ul>
      )}

      <Button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        variant="primary"
        className="studio-mt-sm"
      >
        <ButtonIcon name="plus" />
        {uploading ? 'Uploading…' : 'Add photo'}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        disabled={uploading}
        className="studio-hidden-file-input"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void onFile(f)
          e.target.value = ''
        }}
      />
      {error && <p className="studio-notice studio-notice--error studio-mt-sm">{error}</p>}
    </Panel>
  )
}
