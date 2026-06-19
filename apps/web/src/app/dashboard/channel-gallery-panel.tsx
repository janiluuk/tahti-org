// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  CHANNEL_GALLERY_MODES,
  CHANNEL_GALLERY_MODE_HINTS,
  CHANNEL_GALLERY_MODE_LABELS,
  CHANNEL_GALLERY_SOURCE_URL,
  isWebGLGalleryMode,
  parseGalleryImageLines,
  type ChannelGalleryMode,
} from '@tahti/shared'
import { Panel } from '@tahti/ui'
import { updateChannelGallery } from './channel-gallery-actions'

const WEBGL_MODES = CHANNEL_GALLERY_MODES.filter((m) => m !== 'NONE' && m !== 'STATIC_SLIDESHOW')
const SIMPLE_MODES = CHANNEL_GALLERY_MODES.filter((m) => m === 'NONE' || m === 'STATIC_SLIDESHOW')

export default function ChannelGalleryPanel({
  initial,
  bare = false,
}: {
  initial: {
    galleryMode: ChannelGalleryMode
    slideshowImages: string[]
    videoBackgroundUrl?: string | null
  }
  bare?: boolean
}) {
  const router = useRouter()
  const [galleryMode, setGalleryMode] = useState<ChannelGalleryMode>(initial.galleryMode)
  const [imageLines, setImageLines] = useState(initial.slideshowImages.join('\n'))
  const [videoBackgroundUrl, setVideoBackgroundUrl] = useState(initial.videoBackgroundUrl ?? '')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const hint = CHANNEL_GALLERY_MODE_HINTS[galleryMode]

  function save() {
    setError(null)
    setMessage(null)
    const slideshowImages = parseGalleryImageLines(imageLines)

    if (galleryMode !== 'NONE' && slideshowImages.length === 0) {
      setError('Add at least one HTTPS image URL for the gallery.')
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

  const form = (
    <>
      <label className="studio-field" htmlFor="gallery-mode">
        <span className="studio-label">Gallery style</span>
        <select
          id="gallery-mode"
          value={galleryMode}
          disabled={isPending}
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

      {hint && <p className="studio-text-muted-sm studio-mb-lg studio-m-0">{hint}</p>}

      {isWebGLGalleryMode(galleryMode) && (
        <p className="studio-notice studio-notice--info studio-mb-lg">
          WebGL galleries load your images as textures. URLs must be public HTTPS and allow
          cross-origin access (CORS) from your channel page.
        </p>
      )}

      <label className="studio-field" htmlFor="video-background">
        <span className="studio-label">Channel video backdrop (optional)</span>
        <span className="studio-text-muted-sm studio-mb-sm">
          HTTPS image URL or YouTube/Vimeo watch link — muted backdrop on your channel page.
        </span>
        <input
          id="video-background"
          type="url"
          value={videoBackgroundUrl}
          disabled={isPending}
          placeholder="https://www.youtube.com/watch?v=…"
          onChange={(e) => setVideoBackgroundUrl(e.target.value)}
          className="studio-input"
        />
      </label>

      {galleryMode !== 'NONE' && (
        <label className="studio-field" htmlFor="gallery-images">
          <span className="studio-label">Your images (one HTTPS URL per line)</span>
          <span className="studio-text-muted-sm studio-mb-sm">
            Public URLs to JPG, PNG, or WebP files.
          </span>
          <textarea
            id="gallery-images"
            rows={5}
            value={imageLines}
            disabled={isPending}
            placeholder={'https://cdn.example/photo1.jpg\nhttps://cdn.example/photo2.jpg'}
            onChange={(e) => setImageLines(e.target.value)}
            className="studio-textarea"
          />
        </label>
      )}

      {error && <p className="studio-notice studio-notice--error">{error}</p>}
      {message && <p className="studio-notice studio-notice--success">{message}</p>}

      <button type="button" className="ui-btn ui-btn--primary" onClick={save} disabled={isPending}>
        {isPending ? 'Saving…' : 'Save gallery'}
      </button>
    </>
  )

  if (bare) return form

  return (
    <Panel
      title="Channel gallery"
      headerTight
      description={
        <>
          Show your photos on your public channel page. Pick a style below — five WebGL galleries
          are inspired by{' '}
          <a href={CHANNEL_GALLERY_SOURCE_URL} target="_blank" rel="noopener noreferrer">
            freefrontend.com/three-js
          </a>
          . Paste up to 10 HTTPS URLs to your own images (CDN or MinIO).
        </>
      }
    >
      {form}
    </Panel>
  )
}
