// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import {
  BACKGROUND_VISUAL_PRESET_DESCRIPTIONS,
  BACKGROUND_VISUAL_PRESET_LABELS,
  IMPLEMENTED_BACKGROUND_VISUAL_PRESETS,
  resolveVisualPresetSettings,
  type ColorScheme,
  type VisualPresetSettings,
  type VisualSettingsMap,
} from '@tahti/shared'

type ImplementedBackgroundPreset = (typeof IMPLEMENTED_BACKGROUND_VISUAL_PRESETS)[number]

interface Props {
  value: ImplementedBackgroundPreset | null
  onChange: (preset: ImplementedBackgroundPreset) => void
  colorScheme: ColorScheme
  onColorSchemeChange: (scheme: ColorScheme) => void
  settingsMap: VisualSettingsMap
  onSettingsChange: (map: VisualSettingsMap) => void
}

/** Compact picker + knobs for the Backdrop preset system — unlike
 * VisualPresetPicker's full gallery (11 header presets with live preview
 * thumbnails), this only ever has one real option today (Bloom), so a small
 * radio-style list plus the same speed/intensity/audio-reactive sliders is
 * enough; a live-thumbnail gallery would be overkill for one preset. */
export function BackdropPresetPanel({
  value,
  onChange,
  colorScheme,
  onColorSchemeChange,
  settingsMap,
  onSettingsChange,
}: Props) {
  const activePreset = value ?? IMPLEMENTED_BACKGROUND_VISUAL_PRESETS[0]
  const settings: VisualPresetSettings = resolveVisualPresetSettings(settingsMap, activePreset)

  function updateSetting(key: keyof VisualPresetSettings, raw: number | boolean) {
    onSettingsChange({
      ...settingsMap,
      [activePreset]: { ...settings, [key]: raw },
    })
  }

  return (
    <div className="studio-field--block">
      <div className="studio-row studio-row--wrap" role="radiogroup" aria-label="Backdrop style">
        {IMPLEMENTED_BACKGROUND_VISUAL_PRESETS.map((id) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={activePreset === id}
            className={`ui-btn ui-btn--sm${activePreset === id ? ' ui-btn--primary' : ' ui-btn--ghost'}`}
            onClick={() => onChange(id)}
          >
            {BACKGROUND_VISUAL_PRESET_LABELS[id]}
          </button>
        ))}
      </div>
      <p className="studio-text-muted-sm">{BACKGROUND_VISUAL_PRESET_DESCRIPTIONS[activePreset]}</p>

      <div className="channel-color-scheme-grid">
        {(
          [
            ['accent', 'Accent'],
            ['highlight', 'Highlight'],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="channel-color-scheme-field">
            <input
              type="color"
              value={colorScheme[key]}
              aria-label={label}
              onChange={(e) => onColorSchemeChange({ ...colorScheme, [key]: e.target.value })}
            />
            <span>
              <span className="studio-label">{label}</span>
              <code className="studio-text-muted-sm">{colorScheme[key]}</code>
            </span>
          </label>
        ))}
      </div>

      <div className="visual-preset-picker__configure">
        <label className="visual-preset-gallery__slider">
          <span>
            Speed <strong>{settings.speed.toFixed(2)}×</strong>
          </span>
          <input
            type="range"
            min={0.25}
            max={2}
            step={0.05}
            value={settings.speed}
            onChange={(e) => updateSetting('speed', Number(e.target.value))}
          />
        </label>
        <label className="visual-preset-gallery__slider">
          <span>
            Intensity <strong>{settings.intensity.toFixed(2)}×</strong>
          </span>
          <input
            type="range"
            min={0.25}
            max={2}
            step={0.05}
            value={settings.intensity}
            onChange={(e) => updateSetting('intensity', Number(e.target.value))}
          />
        </label>
        <label className="studio-social-toggle">
          <input
            type="checkbox"
            checked={settings.audioReactive}
            onChange={(e) => updateSetting('audioReactive', e.target.checked)}
          />
          <span>React to audio</span>
        </label>
      </div>
    </div>
  )
}
