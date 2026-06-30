// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { resolveChannelUrl } from '@/lib/app-url'
import {
  BRAND_ACCENT_PRESETS,
  CHANNEL_HEADER_STYLES,
  CHANNEL_HEADER_STYLE_LABELS,
  ColorSchemeSchema,
  DEFAULT_COLOR_SCHEME,
  type ChannelHeaderStyle,
  type VisualPreset,
  type SlideshowPreset,
  type ColorScheme,
} from '@tahti/shared'
import { Panel } from '@tahti/ui'
import { VisualPresetPicker } from '@/components/visuals/visual-preset-picker'

interface Props {
  channelSlug: string
  /** Video loop header is a paid-tier feature. */
  tier: string
  /** Whether Channel.videoBackgroundUrl (Gallery & backdrop) is already configured. */
  hasVideoBackground: boolean
  initial: {
    visualPreset: VisualPreset
    colorSchemeJson: string | null
    headerStyle: ChannelHeaderStyle
    brandAccentPreset: string | null
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

export type ChannelVisualDraft = {
  visualPreset: VisualPreset
  colorSchemeJson: string | null
  headerStyle: ChannelHeaderStyle
  brandAccentPreset: string | null
  slideshowPreset: SlideshowPreset
  slideshowIntervalSeconds: number
  slideshowTransitionMs: number
  slideshowAutoplay: boolean
}

export default function ChannelVisualPresetPanel({
  channelSlug,
  tier,
  hasVideoBackground,
  initial,
  bare = false,
  onDraftChange,
}: Props & { bare?: boolean; onDraftChange?: (draft: ChannelVisualDraft) => void }) {
  const [preset, setPreset] = useState<VisualPreset>(initial.visualPreset)
  const parsed = parseOrNull(initial.colorSchemeJson)
  const [scheme, setScheme] = useState<ColorScheme>(parsed ?? DEFAULT_COLOR_SCHEME)
  const [useCustomScheme, setUseCustomScheme] = useState(!!parsed)
  const [brandAccentPreset, setBrandAccentPreset] = useState(initial.brandAccentPreset)
  const [headerStyle, setHeaderStyle] = useState<ChannelHeaderStyle>(initial.headerStyle)

  const canUseVideoLoop = tier !== 'FREE'

  // Slideshow-transition fields live on /dashboard/channel/gallery (ChannelSlideshowPanel) now —
  // pass them through unchanged so this panel's save doesn't clobber them.
  useEffect(() => {
    onDraftChange?.({
      visualPreset: preset,
      colorSchemeJson: useCustomScheme ? JSON.stringify(scheme) : null,
      headerStyle,
      brandAccentPreset,
      slideshowPreset: initial.slideshowPreset,
      slideshowIntervalSeconds: initial.slideshowIntervalSeconds,
      slideshowTransitionMs: initial.slideshowTransitionMs,
      slideshowAutoplay: initial.slideshowAutoplay,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, scheme, useCustomScheme, headerStyle, brandAccentPreset])

  function updateColor(key: keyof ColorScheme, value: string) {
    setScheme((s) => ({ ...s, [key]: value }))
  }

  function selectBrandAccent(presetId: string) {
    const accentPreset = BRAND_ACCENT_PRESETS.find((p) => p.id === presetId)
    if (!accentPreset) return
    setBrandAccentPreset(presetId)
    setUseCustomScheme(true)
    setScheme((s) => ({ ...s, accent: accentPreset.accent, highlight: accentPreset.highlight }))
  }

  function selectHeaderStyle(style: ChannelHeaderStyle) {
    if (style === 'VIDEO_LOOP' && !canUseVideoLoop) return
    setHeaderStyle(style)
  }

  const form = (
    <>
      <div className="studio-field--block">
        <span className="studio-label">Brand accent</span>
        <div className="channel-accent-swatches">
          {BRAND_ACCENT_PRESETS.map((accentPreset) => (
            <button
              key={accentPreset.id}
              type="button"
              className={`channel-accent-swatch${brandAccentPreset === accentPreset.id ? ' channel-accent-swatch--active' : ''}`}
              style={{ background: accentPreset.gradient }}
              aria-label={`Brand accent: ${accentPreset.id}`}
              onClick={() => selectBrandAccent(accentPreset.id)}
            />
          ))}
        </div>
      </div>

      <div className="studio-field--block">
        <span className="studio-label">Header style</span>
        <div className="channel-header-style-tiles">
          {CHANNEL_HEADER_STYLES.map((style) => {
            const locked = style === 'VIDEO_LOOP' && !canUseVideoLoop
            return (
              <button
                key={style}
                type="button"
                disabled={locked}
                className={`channel-header-style-tile${headerStyle === style ? ' channel-header-style-tile--active' : ''}`}
                onClick={() => selectHeaderStyle(style)}
              >
                {CHANNEL_HEADER_STYLE_LABELS[style]}
                {locked ? <span className="channel-header-style-tile__badge">paid</span> : null}
              </button>
            )
          })}
        </div>
        {headerStyle === 'VIDEO_LOOP' && !hasVideoBackground ? (
          <p className="studio-text-muted-sm studio-mt-sm">
            No backdrop video set yet —{' '}
            <Link href="/dashboard/channel/gallery">configure it in Gallery &amp; backdrop →</Link>
          </p>
        ) : null}
      </div>

      <div className="studio-field--block">
        <span className="studio-label">Background visualizer</span>
        <VisualPresetPicker
          value={preset}
          onChange={setPreset}
          colorScheme={useCustomScheme ? scheme : undefined}
          showPreview
        />
      </div>

      <label className="studio-social-toggle studio-mb-sm">
        <input
          id="custom-scheme-toggle"
          type="checkbox"
          checked={useCustomScheme}
          onChange={(e) => setUseCustomScheme(e.target.checked)}
        />
        <span>Use custom color scheme</span>
      </label>

      {useCustomScheme && (
        <div className="studio-color-scheme-grid">
          {(['bg', 'accent', 'text', 'muted', 'highlight'] as (keyof ColorScheme)[]).map((key) => (
            <div key={key} className="studio-field--block">
              <label className="studio-label" htmlFor={`color-${key}`}>
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </label>
              <div className="studio-color-input-row">
                <input
                  id={`color-${key}`}
                  type="color"
                  value={scheme[key]}
                  onChange={(e) => updateColor(key, e.target.value)}
                />
                <input
                  type="text"
                  value={scheme[key]}
                  maxLength={7}
                  onChange={(e) => updateColor(key, e.target.value)}
                  className="studio-input"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {!bare ? (
        <div className="studio-actions studio-row--wrap">
          <Link
            href={resolveChannelUrl(channelSlug)}
            className="ui-btn ui-btn--secondary"
            target="_blank"
          >
            Preview channel →
          </Link>
        </div>
      ) : null}
    </>
  )

  if (bare) return form

  return (
    <Panel
      title="Visual style"
      headerTight
      description="Brand accent, header banner, and background visualizer for your public channel page."
    >
      {form}
    </Panel>
  )
}
