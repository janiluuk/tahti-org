// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  VISUAL_PRESETS,
  VISUAL_PRESET_LABELS,
  VISUAL_PRESET_DESCRIPTIONS,
  SLIDESHOW_PRESETS,
  SLIDESHOW_PRESET_LABELS,
  ColorSchemeSchema,
  type VisualPreset,
  type SlideshowPreset,
  type ColorScheme,
} from '@tahti/shared'
import { Alert, Button, Field, Panel, Select, Text } from '@/components/ui'
import { updateChannelVisual } from './channel-visual-actions'

interface Props {
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

const BLANK_SCHEME: ColorScheme = {
  bg: '#0a0f1e',
  accent: '#7c3aed',
  text: '#f1f5f9',
  muted: '#64748b',
  highlight: '#a78bfa',
}

export default function ChannelVisualPresetPanel({ initial }: Props) {
  const router = useRouter()
  const [preset, setPreset] = useState<VisualPreset>(initial.visualPreset)
  const parsed = parseOrNull(initial.colorSchemeJson)
  const [scheme, setScheme] = useState<ColorScheme>(parsed ?? BLANK_SCHEME)
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
      description="Choose a Three.js background visualizer, customize your channel color palette, and control slideshow transition style."
    >
      <Field label="Background visualizer" htmlFor="visual-preset">
        <Select
          id="visual-preset"
          value={preset}
          disabled={isPending}
          onChange={(e) => setPreset(e.target.value as VisualPreset)}
        >
          {VISUAL_PRESETS.map((p) => (
            <option key={p} value={p}>
              {VISUAL_PRESET_LABELS[p]}
            </option>
          ))}
        </Select>
      </Field>

      {preset !== 'MINIMAL' && (
        <Text size="sm" tone="muted" className="studio-mb-lg">
          {VISUAL_PRESET_DESCRIPTIONS[preset]}
        </Text>
      )}

      <Field label="Color palette" htmlFor="custom-scheme-toggle">
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <input
            id="custom-scheme-toggle"
            type="checkbox"
            checked={useCustomScheme}
            disabled={isPending}
            onChange={(e) => setUseCustomScheme(e.target.checked)}
          />
          Use custom color palette
        </label>
      </Field>

      {useCustomScheme && (
        <div className="studio-color-scheme-grid">
          {(['bg', 'accent', 'text', 'muted', 'highlight'] as (keyof ColorScheme)[]).map((key) => (
            <Field
              key={key}
              label={key.charAt(0).toUpperCase() + key.slice(1)}
              htmlFor={`color-${key}`}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  id={`color-${key}`}
                  type="color"
                  value={scheme[key]}
                  disabled={isPending}
                  onChange={(e) => updateColor(key, e.target.value)}
                  style={{
                    width: 40,
                    height: 32,
                    padding: 2,
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                  }}
                />
                <input
                  type="text"
                  value={scheme[key]}
                  disabled={isPending}
                  maxLength={7}
                  pattern="#[0-9a-fA-F]{6}"
                  onChange={(e) => updateColor(key, e.target.value)}
                  style={{
                    fontFamily: 'monospace',
                    width: '7ch',
                    fontSize: '0.85rem',
                    background: 'transparent',
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                    padding: '0 4px',
                    color: 'var(--text)',
                  }}
                />
              </div>
            </Field>
          ))}
        </div>
      )}

      <div
        style={{ borderTop: '1px solid var(--border)', margin: '1.25rem 0', paddingTop: '1.25rem' }}
      >
        <Text
          size="sm"
          tone="muted"
          style={{ marginBottom: '0.75rem', display: 'block', fontWeight: 500 }}
        >
          Slideshow transition
        </Text>
      </div>

      <Field label="Transition style" htmlFor="slideshow-preset">
        <Select
          id="slideshow-preset"
          value={slideshowPreset}
          disabled={isPending}
          onChange={(e) => setSlideshowPreset(e.target.value as SlideshowPreset)}
        >
          {SLIDESHOW_PRESETS.map((p) => (
            <option key={p} value={p}>
              {SLIDESHOW_PRESET_LABELS[p]}
            </option>
          ))}
        </Select>
      </Field>

      <Field label={`Interval: ${interval}s`} htmlFor="slideshow-interval">
        <input
          id="slideshow-interval"
          type="range"
          min={5}
          max={30}
          step={1}
          value={interval}
          disabled={isPending}
          onChange={(e) => setInterval(Number(e.target.value))}
          style={{ width: '100%' }}
        />
      </Field>

      <Field label={`Transition speed: ${transition}ms`} htmlFor="slideshow-transition">
        <input
          id="slideshow-transition"
          type="range"
          min={300}
          max={1500}
          step={100}
          value={transition}
          disabled={isPending}
          onChange={(e) => setTransition(Number(e.target.value))}
          style={{ width: '100%' }}
        />
      </Field>

      <Field label="Autoplay slideshow" htmlFor="slideshow-autoplay">
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <input
            id="slideshow-autoplay"
            type="checkbox"
            checked={autoplay}
            disabled={isPending}
            onChange={(e) => setAutoplay(e.target.checked)}
          />
          Automatically advance slides
        </label>
      </Field>

      {error && <Alert variant="error">{error}</Alert>}
      {message && <Alert variant="success">{message}</Alert>}

      <Button type="button" variant="primary" onClick={save} disabled={isPending}>
        {isPending ? 'Saving…' : 'Save visual style'}
      </Button>
    </Panel>
  )
}
