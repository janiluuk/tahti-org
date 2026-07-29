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

/**
 * PERF-007: a static CSS approximation of each preset's look, shown for every
 * card except the currently-selected one. Previously every non-MINIMAL card
 * mounted a live ChannelVisualizer — 4 simultaneous WebGL contexts + RAF loops
 * just to animate thumbnails nobody was looking at, on a page that can show
 * this picker more than once (channel/release/archive-item visual settings).
 */
function StaticPresetThumbnail({ preset, scheme }: { preset: VisualPreset; scheme: ColorScheme }) {
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
            `radial-gradient(ellipse 30% 12% at 60% 40%, #fff5 0 100%, transparent 100%)`,
            `radial-gradient(ellipse 24% 10% at 25% 55%, #fff4 0 100%, transparent 100%)`,
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
  // LENS_FLARES
  return (
    <div
      className="visual-preset-picker__thumb"
      aria-hidden
      style={{
        background: '#000',
        backgroundImage: [
          `radial-gradient(circle at 30% 35%, ${scheme.accent} 0 8%, transparent 20%)`,
          `radial-gradient(circle at 65% 60%, ${scheme.highlight} 0 5%, transparent 14%)`,
          `radial-gradient(circle at 50% 48%, ${scheme.muted} 0 3%, transparent 10%)`,
        ].join(', '),
      }}
    />
  )
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
              {preset === 'MINIMAL' ? (
                <div
                  className="visual-preset-picker__preview visual-preset-picker__preview--minimal"
                  style={{ background: scheme.bg }}
                  aria-hidden
                >
                  <span className="visual-preset-picker__minimal-label">None</span>
                </div>
              ) : showPreview && active ? (
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
                  className="visual-preset-picker__preview"
                  style={{ background: scheme.bg }}
                  aria-hidden
                >
                  <StaticPresetThumbnail preset={preset} scheme={scheme} />
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
