// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useId, useState } from 'react'
import {
  VISUAL_PRESETS,
  VISUAL_PRESET_LABELS,
  VISUAL_PRESET_DESCRIPTIONS,
  DEFAULT_COLOR_SCHEME,
  DEFAULT_VISUAL_PRESET_SETTINGS,
  resolveColorScheme,
  resolveVisualPresetSettings,
  type VisualPreset,
  type ColorScheme,
  type VisualPresetSettings,
  type VisualSettingsMap,
} from '@tahti/shared'
import { Button } from '@tahti/ui'
import { ChannelVisualizer } from './channel-visualizer'
import { PresetThumb } from './visual-preset-thumbs'
import { GalleryIcon, ConfigureIcon, ArrowIcon } from './visual-preset-icons'

export type ColorSchemeEditorProps = {
  enabled: boolean
  onEnabledChange: (enabled: boolean) => void
  scheme: ColorScheme
  onSchemeChange: (key: keyof ColorScheme, value: string) => void
  /** Checkbox label; default is “Use custom color scheme”. */
  enabledLabel?: string
  /** Optional note shown when the custom scheme is off. */
  offHint?: string
}

interface Props {
  value: VisualPreset
  onChange: (preset: VisualPreset) => void
  disabled?: boolean
  colorScheme?: ColorScheme
  colorSchemeJson?: string | null
  paletteJson?: string | null
  showPreview?: boolean
  /** Per-preset knobs map. */
  settingsMap?: VisualSettingsMap | null
  onSettingsChange?: (map: VisualSettingsMap) => void
  /** Optional slideshow audio-reactive control shown alongside visualizer controls. */
  audioReactive?: boolean
  onAudioReactiveChange?: (enabled: boolean) => void
  audioReactiveLabel?: string
  /**
   * Custom color scheme UI — rendered inside the Presets gallery only so the
   * main Design column stays accent + header + visualizer strip.
   */
  colorSchemeEditor?: ColorSchemeEditorProps
}

export function VisualPresetPicker({
  value,
  onChange,
  disabled,
  colorScheme,
  colorSchemeJson,
  paletteJson,
  showPreview = true,
  settingsMap,
  onSettingsChange,
  colorSchemeEditor,
  audioReactive,
  onAudioReactiveChange,
  audioReactiveLabel = 'Audio-reactive slideshow',
}: Props) {
  const scheme = colorScheme ?? resolveColorScheme(colorSchemeJson ?? null, paletteJson ?? null)
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [configureOpen, setConfigureOpen] = useState(false)
  const [focus, setFocus] = useState<VisualPreset>(value)
  const titleId = useId()
  const stageSettings = resolveVisualPresetSettings(settingsMap, value)

  function shiftPreset(direction: -1 | 1) {
    const index = VISUAL_PRESETS.indexOf(value)
    const nextIndex = (index + direction + VISUAL_PRESETS.length) % VISUAL_PRESETS.length
    onChange(VISUAL_PRESETS[nextIndex]!)
  }

  useEffect(() => {
    if (galleryOpen) setFocus(value)
  }, [galleryOpen, value])

  useEffect(() => {
    if (!galleryOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [galleryOpen])

  useEffect(() => {
    if (!galleryOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setGalleryOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [galleryOpen])

  const focusSettings = resolveVisualPresetSettings(settingsMap, focus)

  function updatePresetSetting(
    preset: VisualPreset,
    key: keyof VisualPresetSettings,
    raw: number | boolean,
  ) {
    if (!onSettingsChange) return
    const next: VisualSettingsMap = {
      ...(settingsMap ?? {}),
      [preset]: {
        ...resolveVisualPresetSettings(settingsMap, preset),
        [key]: raw,
      },
    }
    onSettingsChange(next)
  }

  function updateFocusSetting(key: keyof VisualPresetSettings, raw: number | boolean) {
    updatePresetSetting(focus, key, raw)
  }

  function selectFromGallery(preset: VisualPreset) {
    onChange(preset)
    setFocus(preset)
  }

  return (
    <div className="visual-preset-picker">
      <div className="visual-preset-picker__stage-shell">
        <button
          type="button"
          className="visual-preset-picker__arrow"
          disabled={disabled}
          onClick={() => shiftPreset(-1)}
          aria-label="Previous visualizer"
          title="Previous visualizer"
        >
          <ArrowIcon direction="left" />
        </button>

        <button
          type="button"
          className="visual-preset-picker__stage-card"
          disabled={disabled}
          aria-haspopup="dialog"
          aria-expanded={galleryOpen}
          title="Browse all visualizer presets"
          onClick={() => {
            // Set the stage selection before mounting the dialog. This avoids
            // one frame of the previously-previewed preset when reopening it.
            setFocus(value)
            setGalleryOpen(true)
          }}
        >
          <PresetThumb
            preset={value}
            scheme={scheme}
            live={showPreview}
            settings={stageSettings}
            size="lg"
          />
          <span className="visual-preset-picker__stage-name">
            <GalleryIcon />
            {VISUAL_PRESET_LABELS[value]}
          </span>
        </button>

        <button
          type="button"
          className="visual-preset-picker__arrow"
          disabled={disabled}
          onClick={() => shiftPreset(1)}
          aria-label="Next visualizer"
          title="Next visualizer"
        >
          <ArrowIcon direction="right" />
        </button>

        {value !== 'MINIMAL' ? (
          <button
            type="button"
            className={`visual-preset-picker__configure-btn${configureOpen ? ' visual-preset-picker__configure-btn--active' : ''}`}
            disabled={disabled}
            aria-expanded={configureOpen}
            aria-label="Configure visualizer"
            title="Configure visualizer"
            onClick={() => setConfigureOpen((v) => !v)}
          >
            <ConfigureIcon />
          </button>
        ) : null}
      </div>

      {configureOpen && value !== 'MINIMAL' ? (
        <div className="visual-preset-picker__configure">
          <label className="visual-preset-gallery__slider">
            <span>
              Speed <strong>{stageSettings.speed.toFixed(2)}×</strong>
            </span>
            <input
              type="range"
              min={0.25}
              max={2}
              step={0.05}
              value={stageSettings.speed}
              disabled={disabled || !onSettingsChange}
              onChange={(e) => updatePresetSetting(value, 'speed', Number(e.target.value))}
            />
          </label>
          <label className="visual-preset-gallery__slider">
            <span>
              Intensity <strong>{stageSettings.intensity.toFixed(2)}×</strong>
            </span>
            <input
              type="range"
              min={0.25}
              max={2}
              step={0.05}
              value={stageSettings.intensity}
              disabled={disabled || !onSettingsChange}
              onChange={(e) => updatePresetSetting(value, 'intensity', Number(e.target.value))}
            />
          </label>
          <label className="studio-social-toggle">
            <input
              type="checkbox"
              checked={stageSettings.audioReactive}
              disabled={disabled || !onSettingsChange}
              onChange={(e) => updatePresetSetting(value, 'audioReactive', e.target.checked)}
            />
            <span>React to audio</span>
          </label>
        </div>
      ) : null}

      {onAudioReactiveChange && audioReactive !== undefined ? (
        <label className="visual-preset-picker__reactive-toggle">
          <input
            type="checkbox"
            checked={audioReactive}
            disabled={disabled}
            onChange={(event) => onAudioReactiveChange(event.target.checked)}
          />
          {audioReactiveLabel}
        </label>
      ) : null}

      {galleryOpen && (
        <div
          className="visual-preset-gallery-overlay"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setGalleryOpen(false)
          }}
        >
          <div
            className="visual-preset-gallery"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            <header className="visual-preset-gallery__header">
              <div>
                <h3 id={titleId} className="visual-preset-gallery__title">
                  Visualizer presets
                </h3>
                <p className="visual-preset-gallery__sub">
                  {colorSchemeEditor
                    ? 'Preview each background visualizer at full size, tune its settings, and set a custom color scheme.'
                    : 'Preview each background visualizer at full size and tune its settings.'}
                </p>
              </div>
              <button
                type="button"
                className="visual-preset-gallery__close"
                aria-label="Close presets"
                onClick={() => setGalleryOpen(false)}
              >
                ×
              </button>
            </header>

            <div className="visual-preset-gallery__body">
              <div className="visual-preset-gallery__stage" style={{ background: scheme.bg }}>
                {focus === 'MINIMAL' ? (
                  <div className="visual-preset-gallery__stage-empty">
                    <span>No background visualizer</span>
                  </div>
                ) : (
                  <ChannelVisualizer
                    preset={focus}
                    colorSchemeJson={JSON.stringify(scheme)}
                    settings={focusSettings}
                    className="visual-preset-gallery__stage-canvas"
                  />
                )}
                <div className="visual-preset-gallery__stage-meta">
                  <strong>{VISUAL_PRESET_LABELS[focus]}</strong>
                  <span>{VISUAL_PRESET_DESCRIPTIONS[focus]}</span>
                </div>
              </div>

              <aside className="visual-preset-gallery__side">
                <div
                  className="visual-preset-gallery__catalog"
                  role="listbox"
                  aria-label="All visualizers"
                >
                  {VISUAL_PRESETS.map((preset) => {
                    const active = focus === preset
                    const selected = value === preset
                    return (
                      <button
                        key={preset}
                        type="button"
                        role="option"
                        aria-selected={active}
                        disabled={disabled}
                        className={`visual-preset-gallery__item${active ? ' visual-preset-gallery__item--focus' : ''}${selected ? ' visual-preset-gallery__item--selected' : ''}`}
                        onClick={() => selectFromGallery(preset)}
                      >
                        <PresetThumb preset={preset} scheme={scheme} size="sm" />
                        <span className="visual-preset-gallery__item-text">
                          <span className="visual-preset-gallery__item-name">
                            {VISUAL_PRESET_LABELS[preset]}
                            {selected ? <em> · active</em> : null}
                          </span>
                          <span className="visual-preset-gallery__item-desc">
                            {VISUAL_PRESET_DESCRIPTIONS[preset]}
                          </span>
                        </span>
                      </button>
                    )
                  })}
                </div>

                {focus !== 'MINIMAL' && onSettingsChange ? (
                  <div className="visual-preset-gallery__settings">
                    <span className="studio-label">Settings for {VISUAL_PRESET_LABELS[focus]}</span>
                    <label className="visual-preset-gallery__slider">
                      <span>
                        Speed <strong>{focusSettings.speed.toFixed(2)}×</strong>
                      </span>
                      <input
                        type="range"
                        min={0.25}
                        max={2}
                        step={0.05}
                        value={focusSettings.speed}
                        disabled={disabled}
                        onChange={(e) => updateFocusSetting('speed', Number(e.target.value))}
                      />
                    </label>
                    <label className="visual-preset-gallery__slider">
                      <span>
                        Intensity <strong>{focusSettings.intensity.toFixed(2)}×</strong>
                      </span>
                      <input
                        type="range"
                        min={0.25}
                        max={2}
                        step={0.05}
                        value={focusSettings.intensity}
                        disabled={disabled}
                        onChange={(e) => updateFocusSetting('intensity', Number(e.target.value))}
                      />
                    </label>
                    <label className="studio-social-toggle">
                      <input
                        type="checkbox"
                        checked={focusSettings.audioReactive}
                        disabled={disabled}
                        onChange={(e) => updateFocusSetting('audioReactive', e.target.checked)}
                      />
                      <span>React to audio</span>
                    </label>
                    <button
                      type="button"
                      className="visual-preset-gallery__reset"
                      disabled={disabled}
                      onClick={() => {
                        const next = { ...(settingsMap ?? {}) }
                        delete next[focus]
                        onSettingsChange(next)
                      }}
                    >
                      Reset to defaults
                    </button>
                  </div>
                ) : null}

                {colorSchemeEditor ? (
                  <div className="visual-preset-gallery__settings">
                    <span className="studio-label">Color scheme</span>
                    <label className="studio-social-toggle studio-mb-sm">
                      <input
                        type="checkbox"
                        checked={colorSchemeEditor.enabled}
                        disabled={disabled}
                        onChange={(e) => colorSchemeEditor.onEnabledChange(e.target.checked)}
                      />
                      <span>{colorSchemeEditor.enabledLabel ?? 'Use custom color scheme'}</span>
                    </label>
                    {!colorSchemeEditor.enabled && colorSchemeEditor.offHint ? (
                      <p className="studio-text-muted-sm studio-mb-sm">
                        {colorSchemeEditor.offHint}
                      </p>
                    ) : null}
                    {colorSchemeEditor.enabled ? (
                      <div className="studio-color-scheme-grid">
                        {(
                          ['bg', 'accent', 'text', 'muted', 'highlight'] as (keyof ColorScheme)[]
                        ).map((key) => (
                          <div key={key} className="studio-field--block">
                            <label className="studio-label" htmlFor={`gallery-color-${key}`}>
                              {key.charAt(0).toUpperCase() + key.slice(1)}
                            </label>
                            <div className="studio-color-input-row">
                              <input
                                id={`gallery-color-${key}`}
                                type="color"
                                value={colorSchemeEditor.scheme[key]}
                                disabled={disabled}
                                onChange={(e) =>
                                  colorSchemeEditor.onSchemeChange(key, e.target.value)
                                }
                              />
                              <input
                                type="text"
                                value={colorSchemeEditor.scheme[key]}
                                disabled={disabled}
                                maxLength={7}
                                onChange={(e) =>
                                  colorSchemeEditor.onSchemeChange(key, e.target.value)
                                }
                                className="studio-input"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="visual-preset-gallery__actions">
                  <Button variant="ghost" onClick={() => setGalleryOpen(false)}>
                    Close
                  </Button>
                  <Button
                    variant="primary"
                    disabled={disabled}
                    onClick={() => {
                      onChange(focus)
                      setGalleryOpen(false)
                    }}
                  >
                    Use {VISUAL_PRESET_LABELS[focus]}
                  </Button>
                </div>
              </aside>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export { DEFAULT_COLOR_SCHEME, DEFAULT_VISUAL_PRESET_SETTINGS }
