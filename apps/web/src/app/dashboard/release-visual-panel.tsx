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
import { ButtonIcon, Panel } from '@tahti/ui'
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
        />
      </div>
      {extracted && !useOverride && (
        <p className="studio-text-muted-sm studio-mb-sm">
          Colors extracted from cover art. Enable override to customize.
        </p>
      )}

      <label className="studio-social-toggle studio-mb-sm">
        <input
          type="checkbox"
          checked={useOverride}
          disabled={isPending}
          onChange={(e) => setUseOverride(e.target.checked)}
        />
        <span>Override color palette</span>
      </label>

      {useOverride && (
        <div className="studio-color-scheme-grid">
          {(['bg', 'accent', 'text', 'muted', 'highlight'] as (keyof ColorScheme)[]).map((key) => (
            <div key={key} className="studio-field--block">
              <label className="studio-label" htmlFor={`rel-color-${key}`}>
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </label>
              <div className="studio-color-input-row">
                <input
                  id={`rel-color-${key}`}
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

      {error && <p className="studio-notice studio-notice--error">{error}</p>}
      {message && <p className="studio-notice studio-notice--success">{message}</p>}

      <button type="button" className="ui-btn ui-btn--primary" onClick={save} disabled={isPending}>
        <ButtonIcon name="save" />
        {isPending ? 'Saving…' : 'Save visual style'}
      </button>
    </Panel>
  )
}
