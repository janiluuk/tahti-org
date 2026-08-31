// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useId, useMemo, useState } from 'react'
import {
  VISUAL_PRESETS,
  VISUAL_PRESET_LABELS,
  VISUAL_PRESET_DESCRIPTIONS,
  VISUAL_PRESET_STRIP,
  DEFAULT_COLOR_SCHEME,
  DEFAULT_VISUAL_PRESET_SETTINGS,
  resolveColorScheme,
  resolveVisualPresetSettings,
  type VisualPreset,
  type ColorScheme,
  type VisualPresetSettings,
  type VisualSettingsMap,
} from '@tahti/shared'
import { brandTokens, Button } from '@tahti/ui'
import { ChannelVisualizer } from './channel-visualizer'

const WHITE = brandTokens.color.base.white
const BLACK = brandTokens.color.base.black

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

/**
 * PERF-007: a static CSS approximation of each preset's look, shown for every
 * card except the currently-selected one. Previously every non-MINIMAL card
 * mounted a live ChannelVisualizer — 4 simultaneous WebGL contexts + RAF loops
 * just to animate thumbnails nobody was looking at, on a page that can show
 * this picker more than once (channel/release/archive-item visual settings).
 */
function StaticPresetThumbnail({ preset, scheme }: { preset: VisualPreset; scheme: ColorScheme }) {
  if (preset === 'WATER_RIPPLE') {
    return (
      <div
        className="visual-preset-picker__thumb"
        aria-hidden
        style={{
          background: `linear-gradient(160deg, ${scheme.highlight}, ${scheme.accent} 60%)`,
          backgroundImage: [
            `radial-gradient(circle at 38% 42%, transparent 0 9%, ${WHITE}33 10%, transparent 12%)`,
            `radial-gradient(circle at 38% 42%, transparent 0 17%, ${WHITE}22 18%, transparent 20%)`,
            `radial-gradient(circle at 38% 42%, transparent 0 25%, ${WHITE}18 26%, transparent 28%)`,
            `linear-gradient(160deg, ${scheme.highlight}, ${scheme.accent} 60%)`,
          ].join(', '),
        }}
      />
    )
  }
  if (preset === 'WAVEFORM_BARS') {
    const heights = [40, 70, 50, 90, 60, 35, 80, 55]
    return (
      <div className="visual-preset-picker__thumb visual-preset-picker__thumb--bars" aria-hidden>
        {heights.map((h, i) => (
          <span
            key={i}
            style={{ height: `${h}%`, background: scheme.accent }}
            className="visual-preset-picker__thumb-bar"
          />
        ))}
      </div>
    )
  }
  if (preset === 'PARTICLE_FIELD') {
    return (
      <div
        className="visual-preset-picker__thumb visual-preset-picker__thumb--particles"
        aria-hidden
        style={{
          backgroundImage: [
            `radial-gradient(circle, ${scheme.accent} 0 3px, transparent 4px)`,
            `radial-gradient(circle, ${scheme.highlight} 0 2px, transparent 3px)`,
          ].join(', '),
          backgroundSize: '28% 34%, 22% 40%',
          backgroundPosition: '10% 20%, 70% 60%',
          backgroundRepeat: 'repeat',
        }}
      />
    )
  }
  if (preset === 'AURORA') {
    return (
      <div
        className="visual-preset-picker__thumb"
        aria-hidden
        style={{
          background: `linear-gradient(135deg, ${scheme.accent}, ${scheme.highlight}, ${scheme.muted})`,
          opacity: 0.85,
        }}
      />
    )
  }
  if (preset === 'REACTIVE_GRID') {
    return (
      <div
        className="visual-preset-picker__thumb"
        aria-hidden
        style={{
          backgroundImage: [
            `linear-gradient(${scheme.accent}55 1px, transparent 1px)`,
            `linear-gradient(90deg, ${scheme.accent}55 1px, transparent 1px)`,
          ].join(', '),
          backgroundSize: '20% 20%',
        }}
      />
    )
  }
  if (preset === 'CLOUDSCAPE') {
    return (
      <div
        className="visual-preset-picker__thumb"
        aria-hidden
        style={{
          background: `linear-gradient(180deg, ${scheme.muted}, ${scheme.accent})`,
          backgroundImage: [
            `radial-gradient(circle at 30% 30%, ${scheme.highlight}aa 0 12%, transparent 13%)`,
            `radial-gradient(ellipse 30% 12% at 60% 40%, ${WHITE}55 0 100%, transparent 100%)`,
            `radial-gradient(ellipse 24% 10% at 25% 55%, ${WHITE}44 0 100%, transparent 100%)`,
            `linear-gradient(180deg, ${scheme.muted}, ${scheme.accent})`,
          ].join(', '),
        }}
      />
    )
  }
  if (preset === 'LINE_TANGLE') {
    return (
      <div
        className="visual-preset-picker__thumb"
        aria-hidden
        style={{
          backgroundImage: [
            `linear-gradient(35deg, transparent 48%, ${scheme.accent}88 49%, transparent 51%)`,
            `linear-gradient(-25deg, transparent 48%, ${scheme.highlight}88 49%, transparent 51%)`,
            `linear-gradient(70deg, transparent 48%, ${scheme.muted}88 49%, transparent 51%)`,
          ].join(', '),
          backgroundSize: '30% 30%, 22% 22%, 26% 26%',
        }}
      />
    )
  }
  if (preset === 'BACKDROP_BOX') {
    return (
      <div
        className="visual-preset-picker__thumb"
        aria-hidden
        style={{
          background: scheme.muted,
          backgroundImage: [
            `linear-gradient(135deg, ${scheme.accent}33, transparent 60%)`,
            `linear-gradient(-8deg, transparent 30%, ${scheme.highlight}55 31%, transparent 33%, transparent 66%, ${scheme.highlight}55 67%, transparent 69%)`,
          ].join(', '),
          backgroundSize: '100% 100%, 46% 46%',
          backgroundPosition: 'center, center',
          backgroundRepeat: 'no-repeat',
        }}
      />
    )
  }
  if (preset === 'LENS_FLARES') {
    return (
      <div
        className="visual-preset-picker__thumb"
        aria-hidden
        style={{
          background: BLACK,
          backgroundImage: [
            `radial-gradient(circle at 30% 35%, ${scheme.accent} 0 8%, transparent 20%)`,
            `radial-gradient(circle at 65% 60%, ${scheme.highlight} 0 5%, transparent 14%)`,
            `radial-gradient(circle at 50% 48%, ${scheme.muted} 0 3%, transparent 10%)`,
          ].join(', '),
        }}
      />
    )
  }
  // IES_SPOTLIGHT
  return (
    <div
      className="visual-preset-picker__thumb"
      aria-hidden
      style={{
        background: BLACK,
        backgroundImage: [
          `radial-gradient(ellipse 20% 30% at 35% 20%, ${scheme.accent}dd 0 30%, transparent 70%)`,
          `radial-gradient(ellipse 16% 26% at 65% 15%, ${scheme.highlight}cc 0 30%, transparent 70%)`,
          `radial-gradient(ellipse 45% 20% at 45% 78%, ${scheme.muted}55 0 100%, transparent 100%)`,
        ].join(', '),
      }}
    />
  )
}

function PresetThumb({
  preset,
  scheme,
  live,
  size = 'sm',
  settings,
}: {
  preset: VisualPreset
  scheme: ColorScheme
  live?: boolean
  size?: 'sm' | 'lg'
  settings?: VisualPresetSettings | null
}) {
  return (
    <div
      className={`visual-preset-picker__preview visual-preset-picker__preview--${size}${
        preset === 'MINIMAL' ? ' visual-preset-picker__preview--minimal' : ''
      }`}
      style={{ background: scheme.bg }}
      aria-hidden
    >
      {preset === 'MINIMAL' ? (
        <span className="visual-preset-picker__minimal-label">None</span>
      ) : (
        <>
          <StaticPresetThumbnail preset={preset} scheme={scheme} />
          {live ? (
            <ChannelVisualizer
              preset={preset}
              colorSchemeJson={JSON.stringify(scheme)}
              settings={settings ?? undefined}
              className="visual-preset-picker__preview-canvas"
            />
          ) : null}
        </>
      )}
    </div>
  )
}

function GalleryIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="1.5" y="1.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <rect x="9.5" y="1.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <rect x="1.5" y="9.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <rect x="9.5" y="9.5" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}

function ArrowIcon({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d={direction === 'left' ? 'M9.5 3.5 5 8l4.5 4.5' : 'M6.5 3.5 11 8l-4.5 4.5'}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function stripPresets(selected: VisualPreset): VisualPreset[] {
  if (VISUAL_PRESET_STRIP.includes(selected)) return [...VISUAL_PRESET_STRIP]
  return [...VISUAL_PRESET_STRIP.slice(0, 3), selected]
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
  const [focus, setFocus] = useState<VisualPreset>(value)
  // PERF-007 stays true — only ever one live instance among the strip cards,
  // triggered by hover/focus rather than always-on for the selected preset.
  const [hoveredStripPreset, setHoveredStripPreset] = useState<VisualPreset | null>(null)
  const titleId = useId()
  const strip = useMemo(() => stripPresets(value), [value])

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

  function updateFocusSetting(key: keyof VisualPresetSettings, raw: number) {
    if (!onSettingsChange) return
    const next: VisualSettingsMap = {
      ...(settingsMap ?? {}),
      [focus]: {
        ...resolveVisualPresetSettings(settingsMap, focus),
        [key]: raw,
      },
    }
    onSettingsChange(next)
  }

  function selectFromGallery(preset: VisualPreset) {
    onChange(preset)
    setFocus(preset)
  }

  return (
    <div className="visual-preset-picker">
      <div className="visual-preset-picker__strip-shell">
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
        <div className="visual-preset-picker__strip" role="radiogroup" aria-label="Visual preset">
          {strip.map((preset) => {
            const active = value === preset
            return (
              <button
                key={preset}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={disabled}
                title={VISUAL_PRESET_LABELS[preset]}
                className={`visual-preset-picker__strip-card${active ? ' visual-preset-picker__strip-card--active' : ''}`}
                onClick={() => onChange(preset)}
                onMouseEnter={() => setHoveredStripPreset(preset)}
                onMouseLeave={() => setHoveredStripPreset((p) => (p === preset ? null : p))}
                onFocus={() => setHoveredStripPreset(preset)}
                onBlur={() => setHoveredStripPreset((p) => (p === preset ? null : p))}
              >
                <PresetThumb
                  preset={preset}
                  scheme={scheme}
                  live={showPreview && hoveredStripPreset === preset}
                  settings={resolveVisualPresetSettings(settingsMap, preset)}
                  size="sm"
                />
                <span className="visual-preset-picker__strip-name">
                  {VISUAL_PRESET_LABELS[preset]}
                </span>
              </button>
            )
          })}
          <button
            type="button"
            className="visual-preset-picker__gallery-btn"
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
            <GalleryIcon />
            <span>Presets</span>
          </button>
        </div>
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
      </div>

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
