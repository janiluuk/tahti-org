// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  ColorSchemeSchema,
  DEFAULT_COLOR_SCHEME,
  type VisualPreset,
  type ColorScheme,
} from '@tahti/shared'
import { Alert, Button, Field, Panel, Text } from '@/components/ui'
import { VisualPresetPicker } from '@/components/visuals/visual-preset-picker'
import { updateReleaseVisual } from './channel-visual-actions'

interface Props {
  releaseId: string
  initial: {
    visualPreset: VisualPreset
    colorSchemeJson: string | null
    paletteJson: string | null
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
      const res = await updateReleaseVisual(releaseId, {
        visualPreset: preset,
        colorScheme: useOverride ? scheme : null,
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
      description="Visualizer and color scheme for this release's smart link page."
    >
      <Field label="Background visualizer">
        <VisualPresetPicker
          value={preset}
          onChange={setPreset}
          disabled={isPending}
          colorScheme={useOverride ? scheme : (extracted ?? undefined)}
          colorSchemeJson={initial.colorSchemeJson}
          paletteJson={initial.paletteJson}
          showPreview
        />
      </Field>
      {extracted && !useOverride && (
        <Text size="sm" tone="muted" className="studio-mb-lg">
          Colors extracted from cover art. Enable override to customize.
        </Text>
      )}

      <Field label="Color palette" htmlFor="rel-custom-scheme">
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <input
            id="rel-custom-scheme"
            type="checkbox"
            checked={useOverride}
            disabled={isPending}
            onChange={(e) => setUseOverride(e.target.checked)}
          />
          Override color palette
        </label>
      </Field>

      {useOverride && (
        <div className="studio-color-scheme-grid">
          {(['bg', 'accent', 'text', 'muted', 'highlight'] as (keyof ColorScheme)[]).map((key) => (
            <Field
              key={key}
              label={key.charAt(0).toUpperCase() + key.slice(1)}
              htmlFor={`rel-color-${key}`}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  id={`rel-color-${key}`}
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

      {error && <Alert variant="error">{error}</Alert>}
      {message && <Alert variant="success">{message}</Alert>}

      <Button type="button" variant="primary" onClick={save} disabled={isPending}>
        {isPending ? 'Saving…' : 'Save visual style'}
      </Button>
    </Panel>
  )
}
