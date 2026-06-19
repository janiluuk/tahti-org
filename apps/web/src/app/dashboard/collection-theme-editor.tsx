// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useTransition } from 'react'
import {
  COLLECTION_GALLERY_MODES,
  COLLECTION_GALLERY_MODE_HINTS,
  COLLECTION_GALLERY_MODE_LABELS,
  COLLECTION_TEXT_LAYER_ALIGN_LABELS,
  COLLECTION_TEXT_LAYER_ALIGNMENTS,
  COLLECTION_TEXT_LAYER_MODE_HINTS,
  COLLECTION_TEXT_LAYER_MODE_LABELS,
  COLLECTION_TEXT_LAYER_MODES,
  isWebGLCollectionGalleryMode,
  parseGalleryImageLines,
  type CollectionGalleryMode,
  type CollectionTextLayerAlignment,
  type CollectionTextLayerMode,
} from '@tahti/shared'
import { updateCollectionGallery, updateCollectionTextLayer } from './collection-actions'

const SIMPLE_GALLERY_MODES = COLLECTION_GALLERY_MODES.filter(
  (m) => m === 'NONE' || m === 'STATIC_SLIDESHOW',
)
const WEBGL_GALLERY_MODES = COLLECTION_GALLERY_MODES.filter(
  (m) => m !== 'NONE' && m !== 'STATIC_SLIDESHOW',
)
const TEXT_EFFECT_MODES = COLLECTION_TEXT_LAYER_MODES.filter((m) => m !== 'NONE')

export interface CollectionThemeInitial {
  galleryMode: CollectionGalleryMode
  slideshowImages: string[]
  videoBackgroundUrl: string | null
  textLayerMode: CollectionTextLayerMode
  textLayerText: string
  textLayerAlign: CollectionTextLayerAlignment
}

export function CollectionThemeEditor({
  slug,
  initial,
  onDone,
}: {
  slug: string
  initial: CollectionThemeInitial
  onDone: () => void
}) {
  const [galleryMode, setGalleryMode] = useState<CollectionGalleryMode>(initial.galleryMode)
  const [imageLines, setImageLines] = useState(initial.slideshowImages.join('\n'))
  const [videoBackgroundUrl, setVideoBackgroundUrl] = useState(initial.videoBackgroundUrl ?? '')
  const [textLayerMode, setTextLayerMode] = useState<CollectionTextLayerMode>(initial.textLayerMode)
  const [textLayerText, setTextLayerText] = useState(initial.textLayerText)
  const [textLayerAlign, setTextLayerAlign] = useState<CollectionTextLayerAlignment>(
    initial.textLayerAlign,
  )
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const galleryHint = COLLECTION_GALLERY_MODE_HINTS[galleryMode]
  const textHint = COLLECTION_TEXT_LAYER_MODE_HINTS[textLayerMode]

  function save() {
    setError(null)
    setMessage(null)

    const slideshowImages = parseGalleryImageLines(imageLines)
    if (galleryMode !== 'NONE' && slideshowImages.length === 0) {
      setError('Add at least one HTTPS image URL for the gallery.')
      return
    }
    const trimmedText = textLayerText.trim()
    if (textLayerMode !== 'NONE' && !trimmedText) {
      setError('Enter text to display when a text effect is enabled.')
      return
    }

    startTransition(async () => {
      const videoUrl = videoBackgroundUrl.trim()
      const galleryRes = await updateCollectionGallery(slug, {
        galleryMode,
        slideshowImages,
        videoBackgroundUrl: videoUrl ? videoUrl : null,
      })
      if (galleryRes.error) {
        setError(galleryRes.error)
        return
      }
      const textRes = await updateCollectionTextLayer(slug, {
        textLayerMode,
        textLayerText: trimmedText,
        textLayerAlign,
      })
      if (textRes.error) {
        setError(textRes.error)
        return
      }
      setMessage('Theme saved.')
      onDone()
    })
  }

  return (
    <div className="studio-mt-md">
      <p className="studio-help studio-m-0">
        Give this collection its own backdrop, independent of your channel theme. Shown on its
        public page at <code>/c/{slug}</code>.
      </p>

      <label className="studio-label-row studio-text-sm studio-mt-sm">
        Gallery style
        <select
          value={galleryMode}
          disabled={isPending}
          onChange={(e) => setGalleryMode(e.target.value as CollectionGalleryMode)}
          className="studio-input studio-select-min"
        >
          <optgroup label="Simple">
            {SIMPLE_GALLERY_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {COLLECTION_GALLERY_MODE_LABELS[mode]}
              </option>
            ))}
          </optgroup>
          <optgroup label="WebGL (Three.js)">
            {WEBGL_GALLERY_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {COLLECTION_GALLERY_MODE_LABELS[mode]}
              </option>
            ))}
          </optgroup>
        </select>
      </label>
      {galleryHint && <p className="studio-text-muted-sm studio-m-0">{galleryHint}</p>}
      {isWebGLCollectionGalleryMode(galleryMode) && (
        <p className="studio-text-muted-sm studio-m-0">
          WebGL galleries load images as textures — URLs must be public HTTPS with CORS allowed.
        </p>
      )}

      {galleryMode !== 'NONE' && (
        <textarea
          value={imageLines}
          disabled={isPending}
          onChange={(e) => setImageLines(e.target.value)}
          placeholder={'https://cdn.example/photo1.jpg\nhttps://cdn.example/photo2.jpg'}
          className="studio-input studio-flex-1"
          rows={4}
        />
      )}

      <input
        type="url"
        value={videoBackgroundUrl}
        disabled={isPending}
        onChange={(e) => setVideoBackgroundUrl(e.target.value)}
        placeholder="Video backdrop — HTTPS image or YouTube/Vimeo URL (optional)"
        className="studio-input studio-flex-1"
      />

      <label className="studio-label-row studio-text-sm studio-mt-sm">
        Text layer effect
        <select
          value={textLayerMode}
          disabled={isPending}
          onChange={(e) => setTextLayerMode(e.target.value as CollectionTextLayerMode)}
          className="studio-input studio-select-min"
        >
          <option value="NONE">{COLLECTION_TEXT_LAYER_MODE_LABELS.NONE}</option>
          {TEXT_EFFECT_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {COLLECTION_TEXT_LAYER_MODE_LABELS[mode]}
            </option>
          ))}
        </select>
      </label>
      {textHint && <p className="studio-text-muted-sm studio-m-0">{textHint}</p>}

      {textLayerMode !== 'NONE' && (
        <>
          <input
            value={textLayerText}
            maxLength={120}
            disabled={isPending}
            onChange={(e) => setTextLayerText(e.target.value)}
            placeholder="Short headline or tagline"
            className="studio-input studio-flex-1"
          />
          <label className="studio-label-row studio-text-sm">
            Alignment
            <select
              value={textLayerAlign}
              disabled={isPending}
              onChange={(e) => setTextLayerAlign(e.target.value as CollectionTextLayerAlignment)}
              className="studio-input studio-select-min"
            >
              {COLLECTION_TEXT_LAYER_ALIGNMENTS.map((align) => (
                <option key={align} value={align}>
                  {COLLECTION_TEXT_LAYER_ALIGN_LABELS[align]}
                </option>
              ))}
            </select>
          </label>
        </>
      )}

      {error && <p className="studio-text-error studio-m-0">{error}</p>}
      {message && <p className="studio-text-success studio-m-0">{message}</p>}

      <div className="studio-row">
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          className="ui-btn ui-btn--primary"
        >
          {isPending ? 'Saving…' : 'Save theme'}
        </button>
        <button type="button" onClick={onDone} className="ui-btn ui-btn--ghost">
          Close
        </button>
      </div>
    </div>
  )
}
