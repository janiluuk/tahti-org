// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  ColorSchemeSchema,
  DEFAULT_COLOR_SCHEME,
  CHANNEL_GALLERY_MODES,
  CHANNEL_GALLERY_MODE_HINTS,
  CHANNEL_GALLERY_MODE_LABELS,
  isWebGLGalleryMode,
  parseGalleryImageLines,
  type VisualPreset,
  type ColorScheme,
  type ChannelGalleryMode,
} from '@tahti/shared'
import { ButtonIcon, Panel, Button } from '@tahti/ui'
import { VisualPresetPicker } from '@/components/visuals/visual-preset-picker'
import { updateReleaseVisual } from './channel-visual-actions'

interface Props {
  releaseId: string
  initial: {
    visualPreset: VisualPreset
    colorSchemeJson: string | null
    paletteJson: string | null
    slideshowImages?: string[]
    galleryMode?: ChannelGalleryMode
    galleryAudioReactive?: boolean
  }
}

function parseOrNull(json: string | null): ColorScheme | null {
  if (!json) return null
  try {
    const p = ColorSchemeSchema.safeParse(JSON.parse(json))
    return p.success ? p.data : null
  } catch {
    return null
  }
}

export default function ReleaseVisualPanel({ releaseId, initial }: Props) {
  const router = useRouter()
  const [preset, setPreset] = useState<VisualPreset>(initial.visualPreset)
  const extracted = parseOrNull(initial.paletteJson)
  const override = parseOrNull(initial.colorSchemeJson)
  const [scheme, setScheme] = useState<ColorScheme>(override ?? extracted ?? DEFAULT_COLOR_SCHEME)
  const [useOverride, setUseOverride] = useState(!!override)
  const [imageLines, setImageLines] = useState((initial.slideshowImages ?? []).join('\n'))
  const [galleryMode, setGalleryMode] = useState<ChannelGalleryMode>(initial.galleryMode ?? 'NONE')
  const [galleryAudioReactive, setGalleryAudioReactive] = useState(
    initial.galleryAudioReactive ?? false,
  )
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function updateColor(key: keyof ColorScheme, value: string) {
    setScheme((s) => ({ ...s, [key]: value }))
  }

  function save() {
    setError(null)
    setMessage(null)
    startTransition(async () => {
      const slideshowImages = parseGalleryImageLines(imageLines)
      if (galleryMode !== 'NONE' && slideshowImages.length === 0) {
        setError('Add at least one HTTPS image URL for the gallery.')
        return
      }
      const res = await updateReleaseVisual(releaseId, {
        visualPreset: preset,
        colorScheme: useOverride ? scheme : null,
        slideshowImages,
        galleryMode,
        galleryAudioReactive,
      })
      if (res.error) {
        setError(res.error)
        return
      }
      setMessage('Visual settings saved.')
      router.refresh()
    })
  }

  return (
    <Panel
      title="Visual style"
      headerTight
      description="Visualizer and colors for this release's smart link page."
    >
      <div className="studio-field--block">
        <span className="studio-label">Background visualizer</span>
        <VisualPresetPicker
          value={preset}
          onChange={setPreset}
          disabled={isPending}
          colorScheme={useOverride ? scheme : (extracted ?? undefined)}
          colorSchemeJson={initial.colorSchemeJson}
          paletteJson={initial.paletteJson}
          showPreview
          colorSchemeEditor={{
            enabled: useOverride,
            onEnabledChange: setUseOverride,
            scheme,
            onSchemeChange: updateColor,
            enabledLabel: 'Override color palette',
            offHint: extracted
              ? 'Colors extracted from cover art. Enable override in Presets to customize.'
              : undefined,
          }}
        />
      </div>

      <label className="studio-field">
        <span className="studio-label">Slideshow image URLs (one per line, max 10)</span>
        <span className="studio-text-muted-sm studio-mb-sm">
          Shown on this release&apos;s smart link page.
        </span>
        <textarea
          rows={3}
          placeholder={'https://cdn.example/photo1.jpg\nhttps://cdn.example/photo2.jpg'}
          value={imageLines}
          disabled={isPending}
          onChange={(e) => setImageLines(e.target.value)}
          className="studio-textarea"
        />
      </label>

      {imageLines.trim() && (
        <>
          <label className="studio-field">
            <span className="studio-label">Slideshow transition</span>
            <select
              value={galleryMode}
              disabled={isPending}
              onChange={(e) => setGalleryMode(e.target.value as ChannelGalleryMode)}
              className="studio-input"
            >
              {CHANNEL_GALLERY_MODES.filter((m) => m !== 'STATIC_SLIDESHOW').map((mode) => (
                <option key={mode} value={mode}>
                  {CHANNEL_GALLERY_MODE_LABELS[mode]}
                </option>
              ))}
            </select>
            {CHANNEL_GALLERY_MODE_HINTS[galleryMode] && (
              <span className="studio-text-muted-sm">
                {CHANNEL_GALLERY_MODE_HINTS[galleryMode]}
              </span>
            )}
          </label>

          {isWebGLGalleryMode(galleryMode) && (
            <label className="studio-label-row studio-text-sm studio-mb-sm">
              <input
                type="checkbox"
                checked={galleryAudioReactive}
                disabled={isPending}
                onChange={(e) => setGalleryAudioReactive(e.target.checked)}
              />
              Audio-reactive — images pulse with this release&apos;s playback
            </label>
          )}
        </>
      )}

      {error && <p className="studio-notice studio-notice--error">{error}</p>}
      {message && <p className="studio-notice studio-notice--success">{message}</p>}

      <Button onClick={save} disabled={isPending} variant="primary">
        <ButtonIcon name="save" />
        {isPending ? 'Saving…' : 'Save visual style'}
      </Button>
    </Panel>
  )
}
