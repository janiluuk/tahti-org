// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { resolveChannelUrl } from '@/lib/app-url'
import {
  BRAND_ACCENT_PRESETS,
  CHANNEL_HEADER_STYLES,
  CHANNEL_HEADER_STYLE_LABELS,
  ColorSchemeSchema,
  DEFAULT_COLOR_SCHEME,
  parseVisualSettingsMap,
  type ChannelHeaderStyle,
  type VisualPreset,
  type SlideshowPreset,
  type ColorScheme,
  type VisualSettingsMap,
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
    visualSettingsJson?: string | null
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
  visualSettingsJson: string | null
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
  hideHeaderStyle = false,
  onDraftChange,
}: Props & {
  bare?: boolean
  /** Header style now lives in the Header & backdrop section (ChannelHeaderStylePanel) — hide it here. */
  hideHeaderStyle?: boolean
  onDraftChange?: (draft: ChannelVisualDraft) => void
}) {
  const [preset, setPreset] = useState<VisualPreset>(initial.visualPreset)
  const lastEnabledPreset = useRef<VisualPreset>(
    initial.visualPreset === 'MINIMAL' ? 'REACTIVE_GRID' : initial.visualPreset,
  )
  const parsed = parseOrNull(initial.colorSchemeJson)
  const [scheme, setScheme] = useState<ColorScheme>(parsed ?? DEFAULT_COLOR_SCHEME)
  const [useCustomScheme, setUseCustomScheme] = useState(!!parsed)
  const [brandAccentPreset, setBrandAccentPreset] = useState(initial.brandAccentPreset)
  const [headerStyle, setHeaderStyle] = useState<ChannelHeaderStyle>(initial.headerStyle)
  const [settingsMap, setSettingsMap] = useState<VisualSettingsMap>(() =>
    parseVisualSettingsMap(initial.visualSettingsJson),
  )

  const canUseVideoLoop = tier !== 'FREE'

  // Slideshow-transition fields live on Media & Presskit (ChannelSlideshowPanel) now —
  // see /dashboard/settings/media#gallery.
  // pass them through unchanged so this panel's save doesn't clobber them.
  useEffect(() => {
    onDraftChange?.({
      visualPreset: preset,
      colorSchemeJson: useCustomScheme ? JSON.stringify(scheme) : null,
      visualSettingsJson: Object.keys(settingsMap).length > 0 ? JSON.stringify(settingsMap) : null,
      headerStyle,
      brandAccentPreset,
      slideshowPreset: initial.slideshowPreset,
      slideshowIntervalSeconds: initial.slideshowIntervalSeconds,
      slideshowTransitionMs: initial.slideshowTransitionMs,
      slideshowAutoplay: initial.slideshowAutoplay,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, scheme, useCustomScheme, headerStyle, brandAccentPreset, settingsMap])

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

  function setVisualizerEnabled(enabled: boolean) {
    if (enabled) {
      setPreset(lastEnabledPreset.current)
      return
    }
    if (preset !== 'MINIMAL') lastEnabledPreset.current = preset
    setPreset('MINIMAL')
  }

  function selectVisualizer(nextPreset: VisualPreset) {
    if (nextPreset !== 'MINIMAL') lastEnabledPreset.current = nextPreset
    setPreset(nextPreset)
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
              aria-pressed={brandAccentPreset === accentPreset.id}
              onClick={() => selectBrandAccent(accentPreset.id)}
            />
          ))}
        </div>
      </div>

      {!hideHeaderStyle ? (
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
                  aria-pressed={headerStyle === style}
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
              Add the video URL in Header &amp; backdrop.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="studio-field--block">
        <div className="channel-visualizer-toggle-row">
          <div>
            <span className="studio-label">Background visualizer</span>
            <p className="studio-help">Add an animated, audio-reactive backdrop to your channel.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={preset !== 'MINIMAL'}
            className="channel-visualizer-switch"
            onClick={() => setVisualizerEnabled(preset === 'MINIMAL')}
          >
            <span className="channel-visualizer-switch__thumb" aria-hidden />
            <span className="studio-sr-only">
              {preset === 'MINIMAL' ? 'Enable visualizer' : 'Disable visualizer'}
            </span>
          </button>
        </div>
        {preset !== 'MINIMAL' ? (
          <div className="channel-visualizer-selection studio-mt-sm">
            <VisualPresetPicker
              value={preset}
              onChange={selectVisualizer}
              colorScheme={useCustomScheme ? scheme : undefined}
              settingsMap={settingsMap}
              onSettingsChange={setSettingsMap}
              showPreview
              colorSchemeEditor={{
                enabled: useCustomScheme,
                onEnabledChange: setUseCustomScheme,
                scheme,
                onSchemeChange: updateColor,
              }}
            />
            <p className="studio-help studio-mt-xs">
              Click the visualizer to browse all presets, or use the gear icon for quick settings.
            </p>
          </div>
        ) : null}
      </div>

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
