// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { resolveChannelUrl } from '@/lib/app-url'
import {
  BRAND_ACCENT_PRESETS,
  ColorSchemeSchema,
  DEFAULT_COLOR_SCHEME,
  parseVisualSettingsMap,
  type BackgroundVisualPreset,
  type ChannelHeaderStyle,
  type VisualPreset,
  type SlideshowPreset,
  type ColorScheme,
  type VisualSettingsMap,
} from '@tahti/shared'
import { Panel, StudioSwitch } from '@tahti/ui'
import { VisualPresetPicker } from '@/components/visuals/visual-preset-picker'
import { BackdropPresetPanel } from '@/components/visuals/backdrop-preset-panel'

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
    useBackgroundGradient?: boolean
    backgroundColorSchemeJson?: string | null
    backgroundVisualPreset?: string | null
    backgroundVisualSettingsJson?: string | null
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
  useBackgroundGradient: boolean
  backgroundColorSchemeJson: string | null
  backgroundVisualPreset: BackgroundVisualPreset | null
  backgroundVisualSettingsJson: string | null
}

export default function ChannelVisualPresetPanel({
  channelSlug,
  tier: _tier,
  hasVideoBackground: _hasVideoBackground,
  initial,
  bare = false,
  onDraftChange,
}: Props & {
  bare?: boolean
  onDraftChange?: (draft: ChannelVisualDraft) => void
}) {
  const [preset, setPreset] = useState<VisualPreset>(initial.visualPreset)
  const lastEnabledPreset = useRef<VisualPreset>(
    initial.visualPreset === 'MINIMAL' ? 'REACTIVE_GRID' : initial.visualPreset,
  )
  const parsed = parseOrNull(initial.colorSchemeJson)
  const [scheme, setScheme] = useState<ColorScheme>(parsed ?? DEFAULT_COLOR_SCHEME)
  const [brandAccentPreset, setBrandAccentPreset] = useState(initial.brandAccentPreset)
  const [settingsMap, setSettingsMap] = useState<VisualSettingsMap>(() =>
    parseVisualSettingsMap(initial.visualSettingsJson),
  )
  const [backdropEnabled, setBackdropEnabled] = useState(initial.useBackgroundGradient ?? false)
  const [backdropPreset, setBackdropPreset] = useState<'BLOOM' | null>(
    initial.backgroundVisualPreset === 'BLOOM' ? 'BLOOM' : null,
  )
  const [backdropScheme, setBackdropScheme] = useState<ColorScheme>(
    parseOrNull(initial.backgroundColorSchemeJson ?? null) ?? DEFAULT_COLOR_SCHEME,
  )
  const [backdropSettingsMap, setBackdropSettingsMap] = useState<VisualSettingsMap>(() =>
    parseVisualSettingsMap(initial.backgroundVisualSettingsJson),
  )

  // Always persist a full color scheme so page backgrounds are never stuck on
  // the platform purple default when the artist only touched brand swatches.
  useEffect(() => {
    onDraftChange?.({
      visualPreset: preset,
      colorSchemeJson: JSON.stringify(scheme),
      visualSettingsJson: Object.keys(settingsMap).length > 0 ? JSON.stringify(settingsMap) : null,
      headerStyle: initial.headerStyle,
      brandAccentPreset,
      slideshowPreset: initial.slideshowPreset,
      slideshowIntervalSeconds: initial.slideshowIntervalSeconds,
      slideshowTransitionMs: initial.slideshowTransitionMs,
      slideshowAutoplay: initial.slideshowAutoplay,
      useBackgroundGradient: backdropEnabled,
      backgroundColorSchemeJson: backdropEnabled ? JSON.stringify(backdropScheme) : null,
      backgroundVisualPreset: backdropEnabled ? backdropPreset : null,
      backgroundVisualSettingsJson:
        backdropEnabled && Object.keys(backdropSettingsMap).length > 0
          ? JSON.stringify(backdropSettingsMap)
          : null,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    preset,
    scheme,
    brandAccentPreset,
    settingsMap,
    backdropEnabled,
    backdropPreset,
    backdropScheme,
    backdropSettingsMap,
  ])

  function updateColor(key: keyof ColorScheme, value: string) {
    setScheme((s) => ({ ...s, [key]: value }))
  }

  function selectBrandAccent(presetId: string) {
    const accentPreset = BRAND_ACCENT_PRESETS.find((p) => p.id === presetId)
    if (!accentPreset) return
    setBrandAccentPreset(presetId)
    setScheme((s) => ({ ...s, accent: accentPreset.accent, highlight: accentPreset.highlight }))
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

      <div className="studio-field--block">
        <span className="studio-label">Page &amp; artist box colors</span>
        <div className="channel-color-scheme-grid">
          {(
            [
              ['bg', 'Background'],
              ['accent', 'Accent'],
              ['highlight', 'Highlight'],
              ['text', 'Text'],
              ['muted', 'Muted'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="channel-color-scheme-field">
              <input
                type="color"
                value={scheme[key]}
                aria-label={label}
                onChange={(e) => {
                  setBrandAccentPreset(null)
                  updateColor(key, e.target.value)
                }}
              />
              <span>
                <span className="studio-label">{label}</span>
                <code className="studio-text-muted-sm">{scheme[key]}</code>
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="studio-field--block">
        <div className="channel-visualizer-toggle-row">
          <span className="studio-label">Background visualizer</span>
          <StudioSwitch
            checked={preset !== 'MINIMAL'}
            onChange={(enabled) => setVisualizerEnabled(enabled)}
            label={preset === 'MINIMAL' ? 'Enable visualizer' : 'Disable visualizer'}
          />
        </div>
        {preset !== 'MINIMAL' ? (
          <div className="channel-visualizer-selection studio-mt-sm">
            <VisualPresetPicker
              value={preset}
              onChange={selectVisualizer}
              colorScheme={scheme}
              settingsMap={settingsMap}
              onSettingsChange={setSettingsMap}
              showPreview
            />
          </div>
        ) : null}
      </div>

      <div className="studio-field--block">
        <div className="channel-visualizer-toggle-row">
          <span className="studio-label">Backdrop</span>
          <StudioSwitch
            checked={backdropEnabled}
            onChange={(enabled) => {
              setBackdropEnabled(enabled)
              if (enabled && !backdropPreset) setBackdropPreset('BLOOM')
            }}
            label={backdropEnabled ? 'Disable backdrop' : 'Enable backdrop'}
          />
        </div>
        <p className="studio-text-muted-sm studio-mt-xs">
          A separate ambient look for your channel page while nothing is playing — distinct from the
          background visualizer above, which reacts to what&apos;s currently on.
        </p>
        {backdropEnabled ? (
          <div className="channel-visualizer-selection studio-mt-sm">
            <BackdropPresetPanel
              value={backdropPreset}
              onChange={setBackdropPreset}
              colorScheme={backdropScheme}
              onColorSchemeChange={setBackdropScheme}
              settingsMap={backdropSettingsMap}
              onSettingsChange={setBackdropSettingsMap}
            />
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
