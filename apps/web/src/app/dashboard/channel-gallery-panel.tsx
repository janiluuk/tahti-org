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
import { Alert, Button, Field, Link, Panel, Select, Text, Textarea } from '@/components/ui'
import { updateChannelGallery } from './channel-gallery-actions'

const WEBGL_MODES = CHANNEL_GALLERY_MODES.filter((m) => m !== 'NONE' && m !== 'STATIC_SLIDESHOW')
const SIMPLE_MODES = CHANNEL_GALLERY_MODES.filter((m) => m === 'NONE' || m === 'STATIC_SLIDESHOW')

export default function ChannelGalleryPanel({
  initial,
}: {
  initial: {
    galleryMode: ChannelGalleryMode
    slideshowImages: string[]
    videoBackgroundUrl?: string | null
  }
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

  return (
    <Panel
      title="Channel gallery"
      headerTight
      description={
        <>
          Show your photos on your public channel page. Pick a style below — five WebGL galleries
          are inspired by{' '}
          <Link href={CHANNEL_GALLERY_SOURCE_URL} target="_blank" rel="noopener noreferrer">
            freefrontend.com/three-js
          </Link>
          . Paste up to 10 HTTPS URLs to your own images (CDN or MinIO).
        </>
      }
    >
      <Field label="Gallery style" htmlFor="gallery-mode">
        <Select
          id="gallery-mode"
          value={galleryMode}
          disabled={isPending}
          onChange={(e) => setGalleryMode(e.target.value as ChannelGalleryMode)}
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
        </Select>
      </Field>

      {hint && (
        <Text size="sm" tone="muted" style={{ marginBottom: '1rem' }}>
          {hint}
        </Text>
      )}

      {isWebGLGalleryMode(galleryMode) && (
        <Alert variant="info" style={{ marginBottom: '1rem' }}>
          WebGL galleries load your images as textures. URLs must be public HTTPS and allow
          cross-origin access (CORS) from your channel page.
        </Alert>
      )}

      <Field
        label="Channel video backdrop (optional)"
        htmlFor="video-background"
        hint="HTTPS image URL or YouTube/Vimeo watch link — muted backdrop on your channel page."
      >
        <input
          id="video-background"
          type="url"
          value={videoBackgroundUrl}
          disabled={isPending}
          placeholder="https://www.youtube.com/watch?v=…"
          onChange={(e) => setVideoBackgroundUrl(e.target.value)}
          style={{ width: '100%', padding: '0.5rem', fontFamily: 'inherit' }}
        />
      </Field>

      {galleryMode !== 'NONE' && (
        <Field
          label="Your images (one HTTPS URL per line)"
          htmlFor="gallery-images"
          hint="Public URLs to JPG, PNG, or WebP files."
        >
          <Textarea
            id="gallery-images"
            rows={5}
            mono
            value={imageLines}
            disabled={isPending}
            placeholder={'https://cdn.example/photo1.jpg\nhttps://cdn.example/photo2.jpg'}
            onChange={(e) => setImageLines(e.target.value)}
          />
        </Field>
      )}

      {error && <Alert variant="error">{error}</Alert>}
      {message && <Alert variant="success">{message}</Alert>}

      <Button type="button" variant="primary" onClick={save} disabled={isPending}>
        {isPending ? 'Saving…' : 'Save gallery'}
      </Button>
    </Panel>
  )
}
