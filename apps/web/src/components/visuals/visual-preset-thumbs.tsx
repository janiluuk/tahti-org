// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { brandTokens } from '@tahti/ui'
import type { VisualPreset, ColorScheme, VisualPresetSettings } from '@tahti/shared'
import { ChannelVisualizer } from './channel-visualizer'

const WHITE = brandTokens.color.base.white
const BLACK = brandTokens.color.base.black

/**
 * PERF-007: a static CSS approximation of each preset's look, shown for every
 * card except the currently-selected one. Previously every non-MINIMAL card
 * mounted a live ChannelVisualizer — 4 simultaneous WebGL contexts + RAF loops
 * just to animate thumbnails nobody was looking at, on a page that can show
 * this picker more than once (channel/release/archive-item visual settings).
 */
export function StaticPresetThumbnail({
  preset,
  scheme,
}: {
  preset: VisualPreset
  scheme: ColorScheme
}) {
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

export function PresetThumb({
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
