// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  CHANNEL_GALLERY_MODES,
  CHANNEL_GALLERY_MODE_LABELS,
  CHANNEL_GALLERY_SOURCE_URL,
  parseGalleryImageLines,
  type ChannelGalleryMode,
  type ChannelHeaderStyle,
} from '@tahti/shared'
import { ButtonIcon, Panel, Button, FileDropzone } from '@tahti/ui'
import { updateChannelGallery } from './channel-gallery-actions'
import { ZoomableLightbox } from '@/components/zoomable-lightbox'
import {
  isImageFile,
  isVideoFile,
  uploadChannelBackdrop,
  uploadUserImage,
} from './channel/_upload-user-media'

const WEBGL_MODES = CHANNEL_GALLERY_MODES.filter((m) => m !== 'NONE' && m !== 'STATIC_SLIDESHOW')
const SIMPLE_MODES = CHANNEL_GALLERY_MODES.filter((m) => m === 'NONE' || m === 'STATIC_SLIDESHOW')
const MAX_GALLERY = 10

export default function ChannelGalleryPanel({
  initial,
  bare = false,
  hideSave = false,
  showVideoBackground = true,
  onDraftChange,
  onHeaderStyleChange,
}: {
  initial: {
    galleryMode: ChannelGalleryMode
    slideshowImages: string[]
    videoBackgroundUrl?: string | null
  }
  bare?: boolean
  /** When true, omit the save button (parent owns Publish). */
  hideSave?: boolean
  /** Only relevant when the channel header uses the video-loop style. */
  showVideoBackground?: boolean
  /** Fires on every edit (before save) so a live preview can mirror the draft. */
  onDraftChange?: (draft: {
    galleryMode: ChannelGalleryMode
    slideshowImages: string[]
    videoBackgroundUrl: string | null
  }) => void
  /** When a video (or backdrop image) is dropped, parent should flip headerStyle to VIDEO_LOOP. */
  onHeaderStyleChange?: (headerStyle: ChannelHeaderStyle) => void
}) {
  const router = useRouter()
  const [galleryMode, setGalleryMode] = useState<ChannelGalleryMode>(initial.galleryMode)
  const [imageLines, setImageLines] = useState(initial.slideshowImages.join('\n'))
  const [videoBackgroundUrl, setVideoBackgroundUrl] = useState(initial.videoBackgroundUrl ?? '')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [uploading, setUploading] = useState(false)
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)
  const previewImages = parseGalleryImageLines(imageLines)

  useEffect(() => {
    onDraftChange?.({
      galleryMode,
      slideshowImages: parseGalleryImageLines(imageLines),
      videoBackgroundUrl: videoBackgroundUrl.trim() || null,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [galleryMode, imageLines, videoBackgroundUrl])

  function save() {
    setError(null)
    setMessage(null)
    const slideshowImages = parseGalleryImageLines(imageLines)

    if (galleryMode !== 'NONE' && slideshowImages.length === 0) {
      setError('Add at least one gallery image.')
      return
    }

    startTransition(async () => {
      const videoUrl = videoBackgroundUrl.trim()
      const res = await updateChannelGallery({
        galleryMode,
        slideshowImages,
        videoBackgroundUrl: videoUrl ? videoUrl : null,
      })
      if (res.error) {
        setError(res.error)
        return
      }
      setMessage('Gallery saved.')
      router.refresh()
    })
  }

  async function handleGalleryFiles(files: File[]) {
    setError(null)
    const images = files.filter(isImageFile)
    const videos = files.filter(isVideoFile)
    if (videos.length > 0) {
      // First video in a gallery drop becomes the header backdrop + VIDEO_LOOP.
      await handleBackdropFiles([videos[0]!])
    }
    if (images.length === 0) {
      if (videos.length === 0) setError('Drop JPEG, PNG, or WebP images (or an MP4/WebM video).')
      return
    }
    const existing = parseGalleryImageLines(imageLines)
    const room = Math.max(0, MAX_GALLERY - existing.length)
    const batch = images.slice(0, room)
    if (batch.length < images.length) {
      setError(`Gallery is limited to ${MAX_GALLERY} images — some files were skipped.`)
    }
    setUploading(true)
    try {
      const uploaded: string[] = []
      for (const file of batch) {
        const result = await uploadUserImage(file)
        uploaded.push(result.url)
      }
      if (uploaded.length === 0) return
      const next = [...existing, ...uploaded]
      setImageLines(next.join('\n'))
      if (galleryMode === 'NONE') setGalleryMode('STATIC_SLIDESHOW')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Image upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function handleBackdropFiles(files: File[]) {
    const file = files[0]
    if (!file) return
    setError(null)
    setUploading(true)
    try {
      const result = await uploadChannelBackdrop(file)
      setVideoBackgroundUrl(result.url)
      onHeaderStyleChange?.('VIDEO_LOOP')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Backdrop upload failed')
    } finally {
      setUploading(false)
    }
  }

  function removeGalleryImage(url: string) {
    const next = parseGalleryImageLines(imageLines).filter((u) => u !== url)
    setImageLines(next.join('\n'))
    if (next.length === 0 && galleryMode === 'STATIC_SLIDESHOW') {
      setGalleryMode('NONE')
    }
  }

  const form = (
    <>
      <label className="studio-field" htmlFor="gallery-mode">
        <span className="studio-label">Gallery style</span>
        <select
          id="gallery-mode"
          value={galleryMode}
          disabled={isPending || uploading}
          onChange={(e) => setGalleryMode(e.target.value as ChannelGalleryMode)}
          className="studio-input"
        >
          <optgroup label="Simple">
            {SIMPLE_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {CHANNEL_GALLERY_MODE_LABELS[mode]}
              </option>
            ))}
          </optgroup>
          <optgroup label="WebGL (Three.js)">
            {WEBGL_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {CHANNEL_GALLERY_MODE_LABELS[mode]}
              </option>
            ))}
          </optgroup>
        </select>
      </label>

      <div className="studio-field--block">
        <span className="studio-label">Gallery images</span>
        <FileDropzone
          label={uploading ? 'Uploading…' : 'Drop images here, or click to browse'}
          hint={`JPEG, PNG, or WebP — up to ${MAX_GALLERY}. Dropping a video sets the header to video loop.`}
          accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
          multiple
          disabled={isPending || uploading}
          onFiles={(files) => void handleGalleryFiles(files)}
        />
        {previewImages.length > 0 && (
          <div className="gallery-preview-grid studio-mt-sm">
            {previewImages.map((url, i) => (
              <div key={`${url}-${i}`} className="gallery-preview-thumb-wrap">
                <button
                  type="button"
                  className="gallery-preview-thumb"
                  onClick={() => setPreviewIndex(i)}
                  aria-label={`Preview image ${i + 1}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" loading="lazy" />
                </button>
                <button
                  type="button"
                  className="gallery-preview-thumb__remove"
                  aria-label={`Remove image ${i + 1}`}
                  onClick={() => removeGalleryImage(url)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showVideoBackground && (
        <div className="studio-field--block">
          <span className="studio-label">Header backdrop (video or image)</span>
          <FileDropzone
            label={uploading ? 'Uploading…' : 'Drop a video or image backdrop'}
            hint="MP4, WebM, JPEG, PNG, WebP, or GIF — max 10 MB. Videos switch header style to video loop."
            accept="video/mp4,video/webm,image/jpeg,image/png,image/webp,image/gif"
            multiple={false}
            disabled={isPending || uploading}
            onFiles={(files) => void handleBackdropFiles(files)}
          />
          {videoBackgroundUrl ? (
            <div className="studio-row studio-gap-sm studio-mt-sm studio-row--wrap">
              <code className="studio-text-muted-sm studio-m-0">{videoBackgroundUrl}</code>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setVideoBackgroundUrl('')}
              >
                Clear
              </Button>
            </div>
          ) : null}
          <label className="studio-field studio-mt-sm" htmlFor="video-background-url">
            <span className="studio-label">Or paste a URL</span>
            <input
              id="video-background-url"
              type="url"
              value={videoBackgroundUrl}
              disabled={isPending || uploading}
              placeholder="https://…"
              onChange={(e) => {
                setVideoBackgroundUrl(e.target.value)
                if (e.target.value.trim()) onHeaderStyleChange?.('VIDEO_LOOP')
              }}
              className="studio-input"
            />
          </label>
        </div>
      )}

      {!hideSave && error && <p className="studio-notice studio-notice--error">{error}</p>}
      {!hideSave && message && <p className="studio-notice studio-notice--success">{message}</p>}
      {hideSave && error && <p className="studio-notice studio-notice--error">{error}</p>}

      {!hideSave && (
        <Button onClick={save} disabled={isPending || uploading} variant="primary">
          <ButtonIcon name="send" />
          {isPending ? 'Publishing…' : 'Publish changes'}
        </Button>
      )}

      {previewIndex !== null && previewIndex < previewImages.length && (
        <ZoomableLightbox
          images={previewImages.map((url) => ({ url }))}
          index={previewIndex}
          onClose={() => setPreviewIndex(null)}
          onNavigate={setPreviewIndex}
        />
      )}
    </>
  )

  if (bare) return form

  return (
    <Panel
      title="Channel gallery"
      headerTight
      description={
        <>
          Show your photos on your public channel page. WebGL galleries are inspired by{' '}
          <a href={CHANNEL_GALLERY_SOURCE_URL} target="_blank" rel="noopener noreferrer">
            freefrontend.com/three-js
          </a>
          .
        </>
      }
    >
      {form}
    </Panel>
  )
}
