// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import {
  VISUAL_PRESETS,
  VISUAL_PRESET_LABELS,
  VISUAL_PRESET_DESCRIPTIONS,
  DEFAULT_COLOR_SCHEME,
  resolveColorScheme,
  type VisualPreset,
  type ColorScheme,
} from '@tahti/shared'
import { ChannelVisualizer } from './channel-visualizer'

interface Props {
  value: VisualPreset
  onChange: (preset: VisualPreset) => void
  disabled?: boolean
  colorScheme?: ColorScheme
  colorSchemeJson?: string | null
  paletteJson?: string | null
  showPreview?: boolean
}

export function VisualPresetPicker({
  value,
  onChange,
  disabled,
  colorScheme,
  colorSchemeJson,
  paletteJson,
  showPreview = true,
}: Props) {
  const scheme = colorScheme ?? resolveColorScheme(colorSchemeJson ?? null, paletteJson ?? null)

  return (
    <div className="visual-preset-picker">
      <div className="visual-preset-picker__grid" role="radiogroup" aria-label="Visual preset">
        {VISUAL_PRESETS.map((preset) => {
          const active = value === preset
          return (
            <button
              key={preset}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              className={`visual-preset-picker__card${active ? ' visual-preset-picker__card--active' : ''}`}
              onClick={() => onChange(preset)}
            >
              {showPreview && preset !== 'MINIMAL' ? (
                <div
                  className="visual-preset-picker__preview"
                  style={{ background: scheme.bg }}
                  aria-hidden
                >
                  <ChannelVisualizer
                    preset={preset}
                    colorSchemeJson={JSON.stringify(scheme)}
                    className="visual-preset-picker__preview-canvas"
                  />
                </div>
              ) : (
                <div
                  className="visual-preset-picker__preview visual-preset-picker__preview--minimal"
                  style={{ background: scheme.bg }}
                  aria-hidden
                >
                  <span className="visual-preset-picker__minimal-label">None</span>
                </div>
              )}
              <span className="visual-preset-picker__name">{VISUAL_PRESET_LABELS[preset]}</span>
              <span className="visual-preset-picker__desc">
                {VISUAL_PRESET_DESCRIPTIONS[preset]}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export { DEFAULT_COLOR_SCHEME }
