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
import { ButtonIcon, Panel, Button } from '@tahti/ui'
import { VisualPresetPicker } from '@/components/visuals/visual-preset-picker'
import { updateArchiveItemVisual } from './channel-visual-actions'

interface Props {
  itemId: string
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

export default function ArchiveVisualPanel({ itemId, initial }: Props) {
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
      const res = await updateArchiveItemVisual(itemId, {
        visualPreset: preset,
        colorScheme: useOverride ? scheme : null,
      })
      if (res.error) {
        setError(res.error)
        return
      }
      setMessage('Saved.')
      router.refresh()
    })
  }

  return (
    <Panel
      title="Visualizer & waveform color"
      headerTight
      description="Background visualizer and waveform accent color when this track plays."
    >
      <div className="studio-field--block">
        <span className="studio-label">Preset</span>
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
            enabledLabel: "Custom accent color (also colors this track's waveform)",
            offHint: extracted
              ? 'Using colors extracted from artwork. Enable a custom scheme in Presets to override.'
              : undefined,
          }}
        />
      </div>

      {error && <p className="studio-notice studio-notice--error">{error}</p>}
      {message && <p className="studio-notice studio-notice--success">{message}</p>}

      <Button onClick={save} disabled={isPending} variant="primary">
        <ButtonIcon name="save" />
        {isPending ? 'Saving…' : 'Save'}
      </Button>
    </Panel>
  )
}
