// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  SLIDESHOW_PRESETS,
  SLIDESHOW_PRESET_LABELS,
  ColorSchemeSchema,
  DEFAULT_COLOR_SCHEME,
  type VisualPreset,
  type SlideshowPreset,
  type ColorScheme,
} from '@tahti/shared'
import { Panel } from '@tahti/ui'
import { VisualPresetPicker } from '@/components/visuals/visual-preset-picker'
import { updateChannelVisual } from './channel-visual-actions'

interface Props {
  channelSlug: string
  initial: {
    visualPreset: VisualPreset
    colorSchemeJson: string | null
    slideshowPreset: SlideshowPreset
    slideshowIntervalSeconds: number
    slideshowTransitionMs: number
    slideshowAutoplay: boolean
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

export default function ChannelVisualPresetPanel({ channelSlug, initial }: Props) {
  const router = useRouter()
  const [preset, setPreset] = useState<VisualPreset>(initial.visualPreset)
  const parsed = parseOrNull(initial.colorSchemeJson)
  const [scheme, setScheme] = useState<ColorScheme>(parsed ?? DEFAULT_COLOR_SCHEME)
  const [useCustomScheme, setUseCustomScheme] = useState(!!parsed)
  const [slideshowPreset, setSlideshowPreset] = useState<SlideshowPreset>(initial.slideshowPreset)
  const [interval, setInterval] = useState(initial.slideshowIntervalSeconds)
  const [transition, setTransition] = useState(initial.slideshowTransitionMs)
  const [autoplay, setAutoplay] = useState(initial.slideshowAutoplay)
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
      const res = await updateChannelVisual({
        visualPreset: preset,
        colorScheme: useCustomScheme ? scheme : null,
        slideshowPreset,
        slideshowIntervalSeconds: interval,
        slideshowTransitionMs: transition,
        slideshowAutoplay: autoplay,
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
      description="Background visualizer, color palette, and gallery slideshow transitions for your public channel page."
    >
      <div className="studio-field--block">
        <span className="studio-label">Background visualizer</span>
        <VisualPresetPicker
          value={preset}
          onChange={setPreset}
          disabled={isPending}
          colorScheme={useCustomScheme ? scheme : undefined}
          showPreview
        />
      </div>

      <label className="studio-social-toggle studio-mb-sm">
        <input
          id="custom-scheme-toggle"
          type="checkbox"
          checked={useCustomScheme}
          disabled={isPending}
          onChange={(e) => setUseCustomScheme(e.target.checked)}
        />
        <span>Use custom color scheme</span>
      </label>

      {useCustomScheme && (
        <div className="studio-color-scheme-grid">
          {(['bg', 'accent', 'text', 'muted', 'highlight'] as (keyof ColorScheme)[]).map((key) => (
            <div key={key} className="studio-field--block">
              <label className="studio-label" htmlFor={`color-${key}`}>
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </label>
              <div className="studio-color-input-row">
                <input
                  id={`color-${key}`}
                  type="color"
                  value={scheme[key]}
                  disabled={isPending}
                  onChange={(e) => updateColor(key, e.target.value)}
                />
                <input
                  type="text"
                  value={scheme[key]}
                  disabled={isPending}
                  maxLength={7}
                  onChange={(e) => updateColor(key, e.target.value)}
                  className="studio-input"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="studio-divider studio-mt-lg">
        <h3 className="studio-text-strong-sm studio-m-0 studio-mb-md">Slideshow transition</h3>
        <p className="studio-text-muted-sm studio-m-0 studio-mb-md">
          Applies when your channel gallery cycles through images.
        </p>

        <div
          className="slideshow-preset-picker__grid"
          role="radiogroup"
          aria-label="Slideshow transition style"
        >
          {SLIDESHOW_PRESETS.map((p) => {
            const active = slideshowPreset === p
            return (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={isPending}
                className={`slideshow-preset-picker__card${active ? ' slideshow-preset-picker__card--active' : ''}`}
                onClick={() => setSlideshowPreset(p)}
              >
                {SLIDESHOW_PRESET_LABELS[p]}
              </button>
            )
          })}
        </div>

        <label className="studio-field" htmlFor="slideshow-interval">
          <span className="studio-label">Interval: {interval}s</span>
          <input
            id="slideshow-interval"
            type="range"
            min={5}
            max={30}
            step={1}
            value={interval}
            disabled={isPending}
            onChange={(e) => setInterval(Number(e.target.value))}
            className="studio-range"
          />
        </label>

        <label className="studio-field" htmlFor="slideshow-transition">
          <span className="studio-label">Transition speed: {transition}ms</span>
          <input
            id="slideshow-transition"
            type="range"
            min={300}
            max={1500}
            step={100}
            value={transition}
            disabled={isPending}
            onChange={(e) => setTransition(Number(e.target.value))}
            className="studio-range"
          />
        </label>

        <label className="studio-social-toggle">
          <input
            id="slideshow-autoplay"
            type="checkbox"
            checked={autoplay}
            disabled={isPending}
            onChange={(e) => setAutoplay(e.target.checked)}
          />
          <span>Automatically advance slides</span>
        </label>
      </div>

      {error && <p className="studio-notice studio-notice--error">{error}</p>}
      {message && <p className="studio-notice studio-notice--success">{message}</p>}

      <div className="studio-actions studio-row--wrap">
        <button
          type="button"
          className="ui-btn ui-btn--primary"
          onClick={save}
          disabled={isPending}
        >
          {isPending ? 'Saving…' : 'Save appearance'}
        </button>
        <Link href={`/c/${channelSlug}`} className="ui-btn ui-btn--secondary" target="_blank">
          Preview channel →
        </Link>
      </div>
    </Panel>
  )
}
